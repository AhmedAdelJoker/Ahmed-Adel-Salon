"""Rate limiting and lockout: the properties the previous implementation lacked.

Four defects motivated this module. Each has a test that fails against the old
code, because "the tests still pass" is exactly what happened when these were
introduced.

1. Per-process counters. Two workers each granted the full quota, so an N-replica
   deployment allowed N times the intended rate, and counters reset on every
   deploy — an attacker simply waited.
2. Unbounded key space. Rotating the source address grew the dict without limit.
   Over IPv6 that is free: one host owns a /64.
3. Trusted `X-Forwarded-For` from any localhost peer, so a client able to reach
   the loopback interface could assert any address and mint a fresh bucket.
4. Behind a reverse proxy, the socket peer is the proxy, so every visitor shared
   one lockout identity. Five failed attempts by anyone locked the whole salon
   out of its own system.
"""

import pytest
from collections import deque

from fastapi import HTTPException

from app.core import limiter
from app.core.account_lockout import AccountLockout
from app.core import rate_limit as rate_limit_module
from app.core.rate_limit import client_identifier


@pytest.fixture(autouse=True)
def _clean_limiter():
    """Each test starts with no shared state and no Redis."""
    limiter.reset_memory()
    limiter.reset_backend_cache()
    yield
    limiter.reset_memory()
    limiter.reset_backend_cache()


class _FakeRequest:
    """Minimal stand-in for starlette's Request."""

    def __init__(self, host: str | None, headers: dict[str, str] | None = None):
        self.client = type("Client", (), {"host": host})() if host else None
        self.headers = {k.lower(): v for k, v in (headers or {}).items()}


# --------------------------------------------------------------------------- #
# Bounded key space (defect 2)
# --------------------------------------------------------------------------- #


def test_memory_fallback_bounds_its_key_space():
    """The old dict grew forever. This asserts a hard ceiling."""
    window = limiter.MemorySlidingWindow(max_tracked_keys=100)

    for i in range(5_000):
        window.hit(f"ip:10.0.0.{i % 256}-{i}", max_requests=10, window_seconds=60)

    assert window.tracked_keys() <= 100, (
        f"unbounded key space: {window.tracked_keys()} keys tracked"
    )


def test_memory_fallback_still_enforces_after_eviction():
    """Evicting cold keys must not disable limiting for the ones that remain."""
    window = limiter.MemorySlidingWindow(max_tracked_keys=50)
    for i in range(200):
        window.hit(f"noise-{i}", max_requests=5, window_seconds=60)

    # A key that was just used survives and still counts toward its quota.
    for _ in range(5):
        assert window.hit("live", max_requests=5, window_seconds=60) is None
    assert window.hit("live", max_requests=5, window_seconds=60) is not None


def test_default_ceiling_is_configurable():
    from app.core.config import settings

    assert settings.RATE_LIMIT_MAX_TRACKED_KEYS > 0


# --------------------------------------------------------------------------- #
# Proxy trust (defects 3 and 4)
# --------------------------------------------------------------------------- #


def test_forwarding_headers_are_ignored_without_a_configured_proxy():
    """The default must be to believe nobody."""
    request = _FakeRequest("127.0.0.1", {"x-forwarded-for": "203.0.113.9"})

    assert client_identifier(request) == "127.0.0.1", (
        "an unconfigured localhost peer was able to spoof its address"
    )


def test_forwarding_headers_are_ignored_from_a_remote_peer():
    request = _FakeRequest("198.51.100.7", {"x-forwarded-for": "203.0.113.9"})

    assert client_identifier(request) == "198.51.100.7"


def test_forwarding_headers_are_believed_from_a_configured_proxy(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["127.0.0.1"])

    request = _FakeRequest("127.0.0.1", {"x-forwarded-for": "203.0.113.9, 10.0.0.1"})

    assert client_identifier(request) == "203.0.113.9"


def test_leftmost_forwarded_entry_is_the_original_client(monkeypatch):
    """`client, proxy1, proxy2` — the client is first, not last."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["127.0.0.1"])

    request = _FakeRequest("127.0.0.1", {"x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2"})

    assert client_identifier(request) == "203.0.113.9"


def test_real_ip_header_is_used_when_forwarded_for_is_absent(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["127.0.0.1"])

    request = _FakeRequest("127.0.0.1", {"x-real-ip": "203.0.113.4"})

    assert client_identifier(request) == "203.0.113.4"


def test_spoofed_header_cannot_buy_extra_login_attempts(monkeypatch):
    """The end-to-end consequence: a forged header must not reset the quota."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", [])
    dependency = rate_limit_module.rate_limit("t", max_requests=3, window_seconds=60)
    request = _FakeRequest("127.0.0.1", {"x-forwarded-for": "1.2.3.4"})

    for _ in range(3):
        _run(dependency, request)

    with pytest.raises(HTTPException) as excinfo:
        _run(dependency, request)
    assert excinfo.value.status_code == 429


def _run(dependency, request):
    """Drives an async FastAPI dependency from a sync test."""
    import asyncio

    return asyncio.get_event_loop_policy().new_event_loop().run_until_complete(
        dependency(request)
    )


# --------------------------------------------------------------------------- #
# Lockout semantics
# --------------------------------------------------------------------------- #


def test_is_locked_does_not_record_a_failure():
    """A read that counted would let a client lock itself out by polling."""
    lockout = AccountLockout(threshold=3, window_seconds=60, lockout_seconds=900)

    for _ in range(50):
        locked, _ = lockout.is_locked("user:owner")
        assert locked is False

    locked, _ = lockout.is_locked("user:owner")
    assert locked is False, "polling is_locked must never trip the threshold"

    # Three real failures is what should lock, not fifty probes.
    for _ in range(3):
        lockout.record_failure("user:owner")
    locked, retry = lockout.is_locked("user:owner")
    assert locked is True
    assert retry > 0


def test_success_clears_the_failure_history():
    """Five typos spread over a day must not add up to a lockout."""
    lockout = AccountLockout(threshold=5, window_seconds=60, lockout_seconds=900)

    for _ in range(4):
        lockout.record_failure("user:owner")
    assert lockout.is_locked("user:owner")[0] is False

    lockout.record_success("user:owner")

    for _ in range(4):
        lockout.record_failure("user:owner")
    locked, _ = lockout.is_locked("user:owner")
    assert locked is False, "a success between failures must reset the count"


def test_further_attempts_do_not_extend_the_lockout():
    lockout = AccountLockout(threshold=2, window_seconds=60, lockout_seconds=900)

    lockout.record_failure("user:owner")
    lockout.record_failure("user:owner")
    first_wait = lockout.is_locked("user:owner")[1]

    for _ in range(20):
        lockout.record_failure("user:owner")

    second_wait = lockout.is_locked("user:owner")[1]
    assert second_wait <= first_wait, (
        "hammering during a lockout extended it, which is a hold-the-account DoS"
    )


def test_lockout_is_per_identifier():
    lockout = AccountLockout(threshold=2, window_seconds=60, lockout_seconds=900)

    lockout.record_failure("user:owner")
    lockout.record_failure("user:owner")

    assert lockout.is_locked("user:owner")[0] is True
    assert lockout.is_locked("user:cashier")[0] is False
    assert lockout.is_locked("ip:203.0.113.1")[0] is False


def test_username_key_is_case_insensitive():
    """`Owner` and `owner` are one account, not two quota buckets."""
    lockout = AccountLockout(threshold=2, window_seconds=60, lockout_seconds=900)

    assert lockout.username_key("Owner") == lockout.username_key("  OWNER ")


def test_ip_and_user_namespaces_are_separate():
    lockout = AccountLockout(threshold=1, window_seconds=60, lockout_seconds=900)

    lockout.record_failure("ip:203.0.113.1")
    assert lockout.is_locked("ip:203.0.113.1")[0] is True
    assert lockout.is_locked("user:203.0.113.1")[0] is False


# --------------------------------------------------------------------------- #
# Backend selection
# --------------------------------------------------------------------------- #


def test_backend_reports_memory_when_redis_is_unset():
    from app.core.config import settings

    assert not (settings.REDIS_URL or "").strip()
    assert limiter.backend_name() == "memory"


def test_redis_backend_is_chosen_when_reachable(monkeypatch):
    """Proves the Redis path is wired, without needing a live server.

    A fake client records the Lua registration, so this asserts that the code
    would talk to Redis rather than silently staying local.
    """
    from app.core.config import settings

    class FakeRedis:
        def __init__(self):
            self.scripts = []

        def register_script(self, body):
            self.scripts.append(body)
            return lambda **kwargs: (1, 0, 1)

        def ping(self):
            return True

    fake = FakeRedis()
    monkeypatch.setattr(settings, "REDIS_URL", "redis://127.0.0.1:6379/0")
    monkeypatch.setattr(limiter, "_build_redis", lambda: fake)
    limiter.reset_backend_cache()

    assert limiter.backend_name() == "redis"
    assert limiter.hit("ip:1.2.3.4", max_requests=5, window_seconds=60) is None
    assert len(fake.scripts) == 3, "hit/inspect/clear should each register a script"


def test_redis_outage_degrades_instead_of_failing_closed(monkeypatch):
    """A cache outage must not take the salon POS offline.

    Fails open onto the in-process fallback: weaker, but the endpoint still
    answers. Refusing to serve logins because Redis is down would be a far
    worse outcome than losing cross-replica consistency for a few minutes.
    """
    from app.core.config import settings

    class BrokenRedis:
        def register_script(self, body):
            def run(**kwargs):
                raise ConnectionError("redis is gone")

            return run

        def ping(self):
            return True

    monkeypatch.setattr(settings, "REDIS_URL", "redis://127.0.0.1:6379/0")
    monkeypatch.setattr(limiter, "_build_redis", lambda: BrokenRedis())
    limiter.reset_backend_cache()

    assert limiter.hit("ip:9.9.9.9", max_requests=2, window_seconds=60) is None
    assert limiter.hit("ip:9.9.9.9", max_requests=2, window_seconds=60) is None
    assert limiter.hit("ip:9.9.9.9", max_requests=2, window_seconds=60) is not None, (
        "the in-process fallback stopped enforcing after Redis failed"
    )


def test_missing_redis_package_does_not_crash_startup(monkeypatch):
    """`redis` is optional, so the desktop build and CI need not install it."""
    import builtins

    from app.core.config import settings

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "redis":
            raise ImportError("No module named 'redis'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    monkeypatch.setattr(settings, "REDIS_URL", "redis://127.0.0.1:6379/0")
    limiter.reset_backend_cache()

    assert limiter._client() is None
    assert limiter.backend_name() == "memory"


def test_config_parses_a_comma_separated_proxy_list(monkeypatch):
    from app.core.config import Settings

    settings = Settings(
        _env_file=None,
        DATABASE_URL="sqlite:///./x.db",
        SECRET_KEY="k" * 40,
        FIRST_SUPERUSER_PASSWORD="LongEnough123",
        TRUSTED_PROXY_IPS="127.0.0.1, 10.0.0.1",
    )
    assert settings.TRUSTED_PROXY_IPS == ["127.0.0.1", "10.0.0.1"]


def test_empty_proxy_list_defaults_to_distrusting_everyone(monkeypatch):
    from app.core.config import Settings

    settings = Settings(
        _env_file=None,
        DATABASE_URL="sqlite:///./x.db",
        SECRET_KEY="k" * 40,
        FIRST_SUPERUSER_PASSWORD="LongEnough123",
    )
    assert settings.TRUSTED_PROXY_IPS == []


def test_rate_limit_module_exposes_no_mutable_counter_state():
    """Guards the refactor: the old module exported a live dict.

    `rate_limit.limiter` used to be an `InMemoryRateLimiter` instance whose
    `_events` dict call sites could reach into, which is what coupled the
    endpoints to the storage. The name still exists, but it now resolves to the
    *module* that owns the state, so the assertion checks for mutable
    containers rather than for the absence of the name.
    """
    import types

    assert isinstance(rate_limit_module.limiter, types.ModuleType)
    for name in dir(rate_limit_module):
        # Dunders are interpreter machinery (`__builtins__` is a dict on every
        # module ever written) and say nothing about this module's design.
        if name.startswith("__"):
            continue
        value = getattr(rate_limit_module, name)
        assert not isinstance(value, (dict, set, list, deque)), (
            f"rate_limit.{name} is a mutable container; state belongs in "
            f"app.core.limiter behind an interface"
        )
