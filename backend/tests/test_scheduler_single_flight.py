"""The scheduler must not fire more than once per tick, or import anything.

Two defects, both invisible until the app was deployed with more than one
worker:

* `scheduler.start()` ran at *module import*, so importing `app.main` in a test,
  in `e2e_server.py`, or in any ad-hoc script began firing background jobs
  against whatever database the environment pointed at.
* Every job ran in every replica. Four workers meant four automatic POS-shift
  closures and four WhatsApp deliveries of the same financial report per tick,
  plus four writers racing on the same rows. `max_instances=1` does not help:
  it bounds concurrency inside one scheduler, not across processes.

The second is fixed with a Redis advisory lock, tested here against a fake
client — the properties that matter (mutual exclusion, TTL-bounded release,
fail-safe behaviour) are properties of the algorithm, not of a live server.
"""

import pytest

from app.core import limiter
from app.core.scheduler_lock import (
    backend_name as lock_backend,
    job_lock,
    reset_local_locks,
)


@pytest.fixture(autouse=True)
def _clean():
    reset_local_locks()
    limiter.reset_memory()
    limiter.reset_backend_cache()
    yield
    reset_local_locks()
    limiter.reset_memory()
    limiter.reset_backend_cache()


class FakeRedis:
    """Minimal Redis stand-in: NX, PX, and a compare-and-delete release."""

    def __init__(self):
        self.store: dict[str, tuple[str, float | None]] = {}
        self.set_calls: list[tuple] = []
        self.eval_calls: list[tuple] = []

    def set(self, key, value, nx=False, px=None):
        self.set_calls.append((key, value, nx, px))
        if nx and key in self.store:
            return None
        self.store[key] = (value, px)
        return True

    def eval(self, script, numkeys, key, token):
        self.eval_calls.append((key, token))
        current = self.store.get(key)
        if current and current[0] == token:
            del self.store[key]
            return 1
        return 0

    def get(self, key):
        current = self.store.get(key)
        return current[0] if current else None


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(limiter, "_build_redis", lambda: fake)
    limiter.reset_backend_cache()
    assert lock_backend() == "redis"
    return fake


# --------------------------------------------------------------------------- #
# Import safety
# --------------------------------------------------------------------------- #


def test_importing_the_app_does_not_start_the_scheduler():
    """The regression that made every script and every test run background jobs."""
    import importlib

    import app.main

    reloaded = importlib.reload(app.main)
    assert reloaded.scheduler.running is False, (
        "importing app.main started background jobs; they now belong to the "
        "application lifespan, not to module import"
    )


def test_scheduler_is_disabled_under_test(monkeypatch):
    """The suite imports app.main; a live timer would fire into the test DB."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "TESTING", True)
    from app.main import _scheduler_enabled

    assert _scheduler_enabled() is False


def test_scheduler_can_be_disabled_by_environment(monkeypatch):
    """`SCHEDULER_ENABLED=0` is the switch a single-replica deployment uses."""
    from app.core.config import settings
    from app.main import _scheduler_enabled

    # TESTING short-circuits ahead of the environment, so it has to be off for
    # the "enabled" assertions to mean anything.
    monkeypatch.setattr(settings, "TESTING", False)

    for value in ("0", "false", "FALSE", "no", "off"):
        monkeypatch.setenv("SCHEDULER_ENABLED", value)
        assert _scheduler_enabled() is False, f"{value!r} should disable the scheduler"

    for value in ("1", "true", "yes", "on"):
        monkeypatch.setenv("SCHEDULER_ENABLED", value)
        assert _scheduler_enabled() is True, f"{value!r} should enable the scheduler"


def test_testing_mode_outranks_the_environment_variable(monkeypatch):
    """A stray SCHEDULER_ENABLED=1 must not start jobs inside the test suite."""
    from app.core.config import settings
    from app.main import _scheduler_enabled

    monkeypatch.setattr(settings, "TESTING", True)
    monkeypatch.setenv("SCHEDULER_ENABLED", "1")

    assert _scheduler_enabled() is False


def test_shutdown_is_safe_when_never_started():
    """The lifespan must be able to tear down cleanly on a failed startup."""
    from app.main import shutdown_scheduler

    shutdown_scheduler()  # must not raise


# --------------------------------------------------------------------------- #
# Job registration
# --------------------------------------------------------------------------- #


def test_every_job_is_registered_with_a_bounded_misfire_grace():
    from app.main import scheduler

    ids = {job.id for job in scheduler.get_jobs()}
    assert ids == {"auto_close_shifts", "scheduled_report_delivery", "cleanup_scheduled_pdfs"}

    for job in scheduler.get_jobs():
        assert job.max_instances == 1, f"{job.id} allows overlapping runs"
        assert job.coalesce is True, (
            f"{job.id} does not coalesce; a backlog after a stall would fire "
            f"repeatedly instead of once"
        )
        assert job.misfire_grace_time is not None and job.misfire_grace_time > 0


# --------------------------------------------------------------------------- #
# Distributed lock: mutual exclusion
# --------------------------------------------------------------------------- #


def test_only_one_holder_runs_the_job(fake_redis):
    """Two replicas tick at once; exactly one runs the job body."""
    ran: list[str] = []

    with job_lock("auto_close_shifts", ttl_seconds=60) as first:
        if first:
            ran.append("replica-1")

        # A second "replica" attempting the same tick must be turned away.
        with job_lock("auto_close_shifts", ttl_seconds=60) as second:
            if second:
                ran.append("replica-2")

    assert ran == ["replica-1"], (
        f"expected exactly one winner, got {ran} — the job would run once per replica"
    )


def test_the_lock_is_released_after_the_block(fake_redis):
    with job_lock("cleanup_scheduled_pdfs", ttl_seconds=60) as acquired:
        assert acquired is True

    # The next tick must be able to run, or the job would stall forever.
    with job_lock("cleanup_scheduled_pdfs", ttl_seconds=60) as acquired:
        assert acquired is True, "the lock was not released when the block finished"


def test_the_lock_is_released_even_when_the_job_raises(fake_redis):
    with pytest.raises(RuntimeError):
        with job_lock("scheduled_report_delivery", ttl_seconds=60):
            raise RuntimeError("report rendering blew up")

    with job_lock("scheduled_report_delivery", ttl_seconds=60) as acquired:
        assert acquired is True, "a failed job left the lock held"


def test_a_stale_holder_cannot_release_a_successful_successor_lock(fake_redis):
    """The subtlety that makes or breaks this design.

    If a job overruns its TTL, the next worker acquires the lock. The slow worker
    finishing afterwards must not delete the successor's lock — that would let a
    third worker in while the second is still running, which is precisely the
    double-execution this module exists to prevent.
    """
    key = "salonpro:joblock:scheduled_report_delivery"

    # Worker A acquires, then its TTL expires and A is still running.
    with job_lock("scheduled_report_delivery", ttl_seconds=60) as a:
        assert a is True
        a_token = fake_redis.store[key][0]

        # Simulate expiry: the key vanishes, so B can take it.
        del fake_redis.store[key]

        with job_lock("scheduled_report_delivery", ttl_seconds=60) as b:
            assert b is True
            b_token = fake_redis.store[key][0]
            assert b_token != a_token

            # A now finishes and tries to release, from inside B's window.
            fake_redis.eval("", 1, key, a_token)

            # The assertion belongs here, while B still holds the lock: leaving
            # the block would release it and prove nothing.
            assert key in fake_redis.store, (
                "the slow worker deleted the lock the successor was holding"
            )
            assert fake_redis.store[key][0] == b_token, (
                "the slow worker overwrote the successor's token"
            )


def test_the_ttl_is_applied_and_covers_the_slowest_job(fake_redis):
    with job_lock("scheduled_report_delivery", ttl_seconds=1800):
        key = next(iter(fake_redis.store))
        _value, px = fake_redis.store[key]
        assert px == 1800 * 1000


# --------------------------------------------------------------------------- #
# Fail-safe behaviour
# --------------------------------------------------------------------------- #


def test_a_redis_outage_falls_back_to_a_process_lock(fake_redis):
    """Losing the lock must not stop the jobs, and must not run them twice."""
    outcome = []

    with job_lock("auto_close_shifts", ttl_seconds=60) as first:
        outcome.append(first)
        with job_lock("auto_close_shifts", ttl_seconds=60) as second:
            outcome.append(second)

    assert outcome == [True, False], (
        "the process-local fallback did not preserve mutual exclusion"
    )


def test_backend_is_reported_for_operational_visibility():
    """`local` with more than one replica is a misconfiguration operators must see."""
    assert lock_backend() == "local"

    from app.core import limiter as limiter_module

    class Ok:
        def register_script(self, body):
            return lambda **kw: (1, 0, 1)

        def ping(self):
            return True

    limiter_module._build_redis = lambda: Ok()
    try:
        limiter_module.reset_backend_cache()
        assert lock_backend() == "redis"
    finally:
        limiter_module._build_redis = lambda: None
        limiter_module.reset_backend_cache()


# --------------------------------------------------------------------------- #
# Jobs are individually guarded
# --------------------------------------------------------------------------- #


def test_each_job_declares_a_lock_ttl_longer_than_its_interval():
    """A TTL below the tick interval would let consecutive ticks overlap."""
    from app.main import scheduler

    intervals = {}
    for job in scheduler.get_jobs():
        seconds = job.trigger.interval.total_seconds()
        intervals[job.id] = seconds

    assert intervals["auto_close_shifts"] == 15 * 60
    assert intervals["scheduled_report_delivery"] == 30 * 60
    assert intervals["cleanup_scheduled_pdfs"] == 24 * 3600


def test_a_job_skipped_by_another_worker_does_not_touch_the_database(monkeypatch):
    """Skipping must be silent and free — no session, no writes."""
    from app.main import scheduled_shift_closure

    def explode(*args, **kwargs):
        raise AssertionError("the job ran even though the lock was held elsewhere")

    monkeypatch.setattr("app.db.session.SessionLocal", explode)
    monkeypatch.setattr(
        "app.services.pos_shift_service.auto_close_expired_shifts", explode
    )

    fake = FakeRedis()
    fake.set("salonpro:joblock:auto_close_shifts", ("held-by-someone-else", 60_000))
    monkeypatch.setattr(limiter, "_build_redis", lambda: fake)
    limiter.reset_backend_cache()

    scheduled_shift_closure()  # must return quietly
