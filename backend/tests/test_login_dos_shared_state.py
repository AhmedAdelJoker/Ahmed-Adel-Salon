"""End-to-end proof that the shared lockout and proxy trust actually work.

The unit tests in `test_rate_limit_shared_state.py` cover the primitives. This
module drives the real `/api/v1/auth/login` endpoint, because the defect that
matters most was never in the limiter — it was in how the login handler
identified its caller.

The scenario: the app sits behind a reverse proxy, as it will the moment it is
deployed to a cloud server. Every request arrives from the proxy's address. The
old handler keyed the lockout on `request.client.host`, so all visitors shared
one identity and five failed attempts by anyone locked the whole salon out of
its own system. That is a denial of service any customer could trigger by
fat-fingering their password.
"""

import pytest

from app.core import limiter
from app.core.config import settings
from tests.helpers import make_user

LOGIN = "/api/v1/auth/login"


@pytest.fixture(autouse=True)
def _clean_limiter():
    limiter.reset_memory()
    limiter.reset_backend_cache()
    yield
    limiter.reset_memory()
    limiter.reset_backend_cache()


@pytest.fixture
def behind_proxy(monkeypatch):
    """Puts the app behind a reverse proxy, as it will be once deployed.

    Two limits are then live at once and they are not the same thing:

    * the rate limiter — `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` per client address per
      `RATE_LIMIT_WINDOW_SECONDS`;
    * the account lockout — `ACCOUNT_LOCKOUT_THRESHOLD` per username, and again
      per address.

    Every test below has to stay inside both, so a loop of N attempts from a
    *single* address is capped at 5. That cap is not incidental: it is the
    whole point of the controls, and a test that ignored it would be asserting
    against a configuration that cannot occur in production.
    """
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["testclient"])


def _post(client, username: str, password: str, *, ip: str = "203.0.113.5"):
    return client.post(
        LOGIN,
        data={"username": username, "password": password},
        headers={"x-forwarded-for": ip},
    )


def test_spoofed_forwarded_header_cannot_lock_out_the_salon(client, db_session):
    """A forged header must not buy a fresh quota.

    Without a configured proxy the header is ignored, so every attempt lands on
    the real identity and the lockout engages — protecting the account instead
    of letting the caller outrun the limit.
    """
    make_user(db_session, username="victim", password="CorrectHorse123", role="cashier")
    db_session.commit()

    for i in range(10):
        _post(client, "victim", "wrong-password", ip=f"10.0.0.{i}")

    blocked = _post(client, "victim", "CorrectHorse123", ip="203.0.113.5")
    assert blocked.status_code == 429, (
        "the lockout did not engage; brute force is unlimited"
    )


def test_attacking_one_account_does_not_lock_the_others(
    client, db_session, behind_proxy
):
    """The original bug: one address was shared by the whole salon.

    Behind a proxy every request arrives from the same socket peer, so the
    handler must key on the forwarded address. When it did not, five failures by
    one customer locked every other customer out of the business.
    """
    make_user(db_session, username="attacker", password="Wrong123", role="cashier")
    make_user(db_session, username="victim", password="CorrectHorse123", role="cashier")
    db_session.commit()

    # Each attempt uses a different source address, so neither the per-address
    # rate limit nor the per-address lockout can be the thing that stops this —
    # the per-username axis has to.
    for i in range(10):
        _post(client, "attacker", "wrong", ip=f"198.51.100.{i + 1}")

    other = _post(client, "victim", "CorrectHorse123", ip="203.0.113.77")
    assert other.status_code == 200, (
        f"an unrelated user was locked out by someone else's failures: "
        f"{other.status_code} {other.text[:200]}"
    )


def test_rotating_addresses_still_trip_the_username_axis(
    client, db_session, behind_proxy
):
    """Per-IP alone is not enough, so the username axis must also count."""
    make_user(db_session, username="target", password="CorrectHorse123", role="cashier")
    db_session.commit()

    for i in range(10):
        _post(client, "target", "wrong", ip=f"192.0.2.{i + 1}")

    blocked = _post(client, "target", "CorrectHorse123", ip="198.51.100.200")
    assert blocked.status_code == 429, (
        "rotating the source address defeated the lockout entirely"
    )


def test_one_address_spraying_many_accounts_is_throttled(
    client, db_session, behind_proxy
):
    """The mirror image: per-username alone would not stop this."""
    for i in range(6):
        make_user(
            db_session, username=f"target{i}", password="CorrectHorse123", role="cashier"
        )
    db_session.commit()

    # Six different usernames, one address: the per-address rate limit engages
    # well before any individual account reaches its lockout threshold.
    for i in range(6):
        _post(client, f"target{i}", "wrong", ip="198.51.100.1")

    blocked = _post(client, "target0", "CorrectHorse123", ip="198.51.100.1")
    assert blocked.status_code == 429, (
        "one host was able to spray passwords across accounts unthrottled"
    )


def test_successful_login_clears_the_history(client, db_session, behind_proxy):
    """Scattered typos must not accumulate into a lockout."""
    make_user(db_session, username="typoist", password="CorrectHorse123", role="cashier")
    db_session.commit()

    for _ in range(3):
        _post(client, "typoist", "typo", ip="203.0.113.9")

    ok = _post(client, "typoist", "CorrectHorse123", ip="203.0.113.9")
    assert ok.status_code == 200, ok.text

    # The counter was reset, so three more mistakes are still survivable. Both
    # windows are cleared here, otherwise the next phase would inherit them.
    limiter.reset_memory()

    for _ in range(3):
        response = _post(client, "typoist", "typo", ip="203.0.113.9")
        assert response.status_code == 401, (
            f"expected a normal rejection, got {response.status_code} {response.text[:160]}"
        )

    limiter.reset_memory()
    final = _post(client, "typoist", "CorrectHorse123", ip="203.0.113.9")
    assert final.status_code == 200, (
        f"a legitimate user was locked out by their own typos: {final.status_code}"
    )


def test_wrong_password_then_right_one_is_allowed(client, db_session):
    make_user(db_session, username="casual", password="CorrectHorse123", role="cashier")
    db_session.commit()

    assert _post(client, "casual", "nope", ip="203.0.113.11").status_code == 401
    assert _post(client, "casual", "CorrectHorse123", ip="203.0.113.11").status_code == 200
