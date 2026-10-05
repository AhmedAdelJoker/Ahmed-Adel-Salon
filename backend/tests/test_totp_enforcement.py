"""Mandatory two-factor authentication for privileged roles.

Two layers, tested separately.

The policy (`app/core/totp_enforcement.py`) is pure arithmetic over a role, a
flag and two timestamps, so it is tested with an injected clock rather than a
database. Clock arithmetic is where this kind of code actually goes wrong: an
off-by-one that locks everyone out at 23:59 on day seven, or a naive/aware
mismatch that raises on the one account nobody tested.

The enforcement is then tested through the real login endpoint, because the part
that matters is not the decision -- it is what the decision produces. A policy
that correctly says BLOCK and an endpoint that ignores it and mints a normal
token is still an unprotected system, and no amount of unit-testing the policy
detects that.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core import totp_enforcement
from app.core.roles import UserRole

NOW = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)


def anchor(days_ago: float) -> datetime:
    return NOW - timedelta(days=days_ago)


def decide(role, totp_enabled=False, first_login=None, created=None, now=NOW):
    return totp_enforcement.decide(
        role=role,
        totp_enabled=totp_enabled,
        first_login_at=first_login,
        created_at=created,
        now=now,
    )


# --------------------------------------------------------------------------
# Who is affected
# --------------------------------------------------------------------------


@pytest.mark.parametrize("role", [UserRole.OWNER.value, UserRole.ADMIN.value, UserRole.MANAGER.value])
def test_privileged_roles_are_affected(role, monkeypatch):
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_REQUIRED_ROLES", ["owner", "admin", "manager"])
    assert totp_enforcement.role_requires_2fa(role) is True


@pytest.mark.parametrize("role", [UserRole.CASHIER.value, UserRole.BARBER.value, UserRole.ACCOUNTANT.value])
def test_frontline_roles_are_not_affected_by_default(role, monkeypatch):
    """Forcing a second factor on the person at the till is a support burden.

    It is also close to theatre: a shared till phone is a weak second factor, and
    a cashier locked out of a busy counter is a salon that stops taking bookings.
    The privileged roles are where the blast radius actually lives.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_REQUIRED_ROLES", ["owner", "admin", "manager"])
    assert totp_enforcement.role_requires_2fa(role) is False


def test_role_matching_ignores_case_and_padding(monkeypatch):
    """The role comes from a database column, not a constant.

    An earlier system stored it with inconsistent capitalisation, so a strict
    comparison would silently exempt a real owner.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_REQUIRED_ROLES", ["owner", "admin"])
    for variant in ("Owner", " OWNER ", "owner", "oWnEr"):
        assert totp_enforcement.role_requires_2fa(variant) is True, variant


def test_a_none_role_is_never_privileged(monkeypatch):
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_REQUIRED_ROLES", ["owner"])
    assert totp_enforcement.role_requires_2fa(None) is False
    assert totp_enforcement.role_requires_2fa("") is False


# --------------------------------------------------------------------------
# The grace period
# --------------------------------------------------------------------------


def test_inside_the_grace_period_is_a_warning_not_a_block(monkeypatch):
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    result = decide(UserRole.OWNER.value, first_login=anchor(3))
    assert result.verdict == totp_enforcement.WARN
    assert result.blocks_full_session is False
    assert result.should_prompt_enrollment is True
    assert "grace_period" in result.reason


def test_on_the_last_day_of_grace_is_still_allowed(monkeypatch):
    """The boundary is the kind of thing that gets an off-by-one.

    At exactly day seven the account is still inside the window. Being strict
    here means an owner who signed in on day one loses access on day seven,
    which is how a security control becomes an outage.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    result = decide(UserRole.OWNER.value, first_login=anchor(7), now=anchor(0))
    assert result.verdict == totp_enforcement.WARN, "day 7 is still inside a 7-day window"
    assert result.deadline == NOW


def test_one_second_past_the_deadline_is_blocked(monkeypatch):
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    result = decide(UserRole.OWNER.value, first_login=NOW - timedelta(days=7, seconds=1))
    assert result.verdict == totp_enforcement.BLOCK
    assert result.blocks_full_session is True


def test_well_past_the_deadline_is_blocked(monkeypatch):
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    result = decide(UserRole.OWNER.value, first_login=anchor(400))
    assert result.verdict == totp_enforcement.BLOCK
    assert result.reason == "grace_period_expired"


# --------------------------------------------------------------------------
# The anchor
# --------------------------------------------------------------------------


def test_first_login_wins_over_created_at(monkeypatch):
    """An account seeded a year ago gets its window from its first real use.

    Anchoring on `created_at` would block it instantly, on the login that proves
    the account is real. That is not a security property, it is a broken
    deployment.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    result = decide(
        UserRole.OWNER.value,
        first_login=anchor(1),
        created=anchor(365),
    )
    assert result.verdict == totp_enforcement.WARN


def test_created_at_is_used_when_the_account_has_never_signed_in(monkeypatch):
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    result = decide(UserRole.OWNER.value, first_login=None, created=anchor(1))
    assert result.verdict == totp_enforcement.WARN


def test_no_timestamps_at_all_is_blocked(monkeypatch):
    """The one case with no safe default.

    Permissive would let an attacker who can create accounts but never sign in
    hold the clock at zero forever. Strict costs a support call for an account
    the database cannot date. Strict.
    """
    result = decide(UserRole.OWNER.value, first_login=None, created=None)
    assert result.verdict == totp_enforcement.BLOCK
    assert result.reason == "no_timestamp_available"


def test_naive_timestamps_do_not_raise(monkeypatch):
    """SQLite returns naive datetimes; Postgres returns aware ones.

    Comparing a naive value with an aware `now()` raises `TypeError`, and the
    account that raises is the account that cannot log in. This is not
    theoretical: it is a dialect difference on the same column.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    naive = (NOW - timedelta(days=1)).replace(tzinfo=None)
    result = decide(UserRole.OWNER.value, first_login=naive)
    assert result.verdict == totp_enforcement.WARN

    assert totp_enforcement._as_utc(naive) == NOW - timedelta(days=1)
    assert totp_enforcement._as_utc(aware := NOW) == aware
    assert totp_enforcement._as_utc(None) is None


def test_a_non_utc_aware_timestamp_is_converted(monkeypatch):
    """Timezone-aware but not UTC is still correct after conversion.

    A deployment that stores local time would otherwise compare a +02:00 value
    against UTC and shift every deadline by two hours.
    """
    from datetime import timedelta as td

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    plus_two = timezone(td(hours=2))
    stamp = (NOW - td(days=1)).astimezone(plus_two)
    result = decide(UserRole.OWNER.value, first_login=stamp)
    assert result.verdict == totp_enforcement.WARN


# --------------------------------------------------------------------------
# The exemptions
# --------------------------------------------------------------------------


def test_an_account_with_2fa_is_exempt_however_old(monkeypatch):
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    result = decide(UserRole.OWNER.value, totp_enabled=True, first_login=anchor(900))
    assert result.verdict == totp_enforcement.EXEMPT
    assert result.blocks_full_session is False


def test_the_kill_switch_stops_everything(monkeypatch):
    """Break-glass, and it has to actually work.

    This is the only way back in for an owner who lost their phone with no
    recovery code. A kill switch that is advisory is useless in exactly the
    emergency it exists for.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", False)
    result = decide(UserRole.OWNER.value, first_login=anchor(900))
    assert result.verdict == totp_enforcement.EXEMPT
    assert result.blocks_full_session is False
    assert result.reason == "enforcement_disabled"


def test_a_zero_grace_period_blocks_immediately(monkeypatch):
    """Someone who wants it strict today should be able to say so.

    Zero is a legitimate configuration, not a misconfiguration, and it is what a
    new deployment with no legacy accounts wants.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 0)
    result = decide(UserRole.OWNER.value, first_login=NOW)
    assert result.verdict == totp_enforcement.BLOCK
    assert result.reason == "grace_period_disabled"


def test_a_negative_grace_period_is_treated_as_zero(monkeypatch):
    """A negative window must not become a window in the future.

    `anchor + timedelta(days=-5)` is earlier than the anchor, so a naive
    comparison would quietly *extend* the grace period rather than remove it --
    the opposite of what a negative value means.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", -5)
    result = decide(UserRole.OWNER.value, first_login=NOW)
    assert result.verdict == totp_enforcement.BLOCK


# --------------------------------------------------------------------------
# The decision is only half of it: the endpoint has to obey it
# --------------------------------------------------------------------------


def login(client, username, password="Cashier123"):
    return client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )


def make_privileged(db_session, username="boss", role="owner", totp_enabled=False):
    from tests.helpers import make_user

    user = make_user(
        db_session,
        username=username,
        password="Str0ngPassword!",
        role=role,
    )
    user.totp_enabled = totp_enabled
    db_session.commit()
    return user


def test_a_blocked_owner_receives_a_token_that_opens_nothing(
    client, db_session, monkeypatch
):
    """The property that makes this a control rather than a prompt.

    The token is valid, correctly signed, unexpired, and for the right account.
    It still cannot open a single staff endpoint, because
    `authenticate_access_token` rejects the scope in the one place every route
    passes through.
    """
    from app.models.user import User

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", True)
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 0)
    user = make_privileged(db_session)
    user.first_login_at = datetime.now(timezone.utc) - timedelta(days=30)
    db_session.commit()

    response = login(client, "boss", "Str0ngPassword!")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body.get("2fa_enrollment_required") is True
    token = body["access_token"]
    assert token

    headers = {"Authorization": f"Bearer {token}"}
    for method, path, payload in (
        ("get", "/api/v1/auth/me", None),
        ("get", "/api/v1/appointments", None),
        ("get", "/api/v1/customers", None),
        ("get", "/api/v1/auth/sessions", None),
    ):
        result = getattr(client, method)(path, headers=headers)
        assert result.status_code == 403, (
            f"{method.upper()} {path} returned {result.status_code} for an "
            "enrolment-only token; the scope check is not covering this route"
        )

    # A mutating route, too: read-only access would be a smaller hole, but the
    # scope is not meant to distinguish.
    created = client.post("/api/v1/customers", json={"name": "X"}, headers=headers)
    assert created.status_code == 403

    db_session.expire_all()
    assert db_session.query(User).filter(User.username == "boss").one() is not None


def test_a_blocked_owner_can_still_complete_enrolment(client, db_session, monkeypatch):
    """Enforced must not mean locked out.

    The whole point of issuing a restricted token rather than a 403 is that the
    user can finish the setup. A control that leaves an owner permanently unable
    to sign in gets switched off within a week, and then nobody has 2FA.
    """
    import pyotp

    from app.models.user import User

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", True)
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 0)
    user = make_privileged(db_session)
    user.first_login_at = datetime.now(timezone.utc) - timedelta(days=30)
    db_session.commit()

    token = login(client, "boss", "Str0ngPassword!").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    setup = client.post("/api/v1/auth/2fa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]

    enable = client.post(
        "/api/v1/auth/2fa/enable", json={"code": pyotp.TOTP(secret).now()}, headers=headers
    )
    assert enable.status_code == 200, enable.text

    # And now a full sign-in works. It needs the TOTP code now, because 2FA is
    # actually on -- a 401 here would mean the enrolment never took effect, which
    # is a different failure from "the second factor is working".
    again = client.post(
        "/api/v1/auth/login",
        data={
            "username": "boss",
            "password": "Str0ngPassword!",
            "totp_code": pyotp.TOTP(secret).now(),
        },
    )
    assert again.status_code == 200, again.text
    assert again.json().get("2fa_enrollment_required") is None
    assert again.json().get("2fa_enrollment_due") is None
    full = again.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {full}"})
    assert me.status_code == 200
    assert me.json()["username"] == "boss"

    db_session.expire_all()
    assert db_session.query(User).filter(User.username == "boss").one().totp_enabled is True


def test_the_enrolment_endpoints_reject_an_unrelated_token(client, db_session, monkeypatch):
    """`get_current_user_or_enrolling` must not become a way around token checks.

    Two failure modes this design could plausibly have had, and the reason each
    matters:

    1. Accepting *only* the restricted token, which would break enrolment for
       everyone who has a normal session.
    2. Accepting anything with a valid signature and skipping the scope check
       entirely, which would make the enrolment token equivalent to a full
       session everywhere.

    Note what is deliberately *not* asserted: that a cashier is refused. Setting
    up TOTP for your own account is not a privilege escalation, and it shipped
    that way before mandatory enforcement existed. The panel for it is in the
    frontend. Refusing it would be a feature removal disguised as hardening, and
    it would leave a cashier who *wants* a second factor unable to have one.
    """
    from tests.helpers import auth_headers, make_user

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", True)
    make_privileged(db_session, username="boss", totp_enabled=True)
    make_user(db_session, username="cashier1", password="Cashier123", role="cashier")

    # Self-service still works for a normal session. This is the regression
    # guard for mode 1 above.
    headers = auth_headers(client, "cashier1")
    own = client.post("/api/v1/auth/2fa/setup", headers=headers)
    assert own.status_code == 200, own.text
    assert own.json()["secret"]

    # A forged scope on a token we cannot sign: rejected as an invalid token,
    # before the scope is considered at all.
    forged = {
        "Authorization": (
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9."
            "eyJzY29wZSI6IjJhZmFfZW5yb2xsbWVudCJ9.nope"
        )
    }
    assert client.post("/api/v1/auth/2fa/setup", headers=forged).status_code == 401

    # No token.
    assert client.post("/api/v1/auth/2fa/setup").status_code == 401


def test_an_enrolment_token_still_cannot_read_anything(client, db_session, monkeypatch):
    """Mode 2 above, pinned from the other side.

    The enrolment token is a *valid* token. What makes it safe is that it is
    accepted in exactly two endpoints and rejected in every other one, so this
    checks the rejection on routes it has no business touching, including routes
    the policy in `totp_enforcement` never mentions.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", True)
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 0)
    user = make_privileged(db_session, username="boss")
    user.first_login_at = datetime.now(timezone.utc) - timedelta(days=30)
    db_session.commit()

    token = login(client, "boss", "Str0ngPassword!").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    for path in (
        "/api/v1/auth/me",
        "/api/v1/auth/sessions",
        "/api/v1/appointments",
        "/api/v1/customers",
        "/api/v1/invoices",
        "/api/v1/users",
        "/api/v1/business-settings",
    ):
        result = client.get(path, headers=headers)
        assert result.status_code == 403, f"{path} returned {result.status_code}"

    # And it cannot mint a refresh token, which is the one way an enrolment
    # session could otherwise escalate itself into a full session.
    refreshed = client.post("/api/v1/auth/refresh", data={"refresh_token": token})
    assert refreshed.status_code != 200, (
        "an enrolment token was accepted at the refresh endpoint, which would "
        "let it upgrade itself to a full session"
    )


def test_an_owner_inside_the_grace_period_gets_a_full_session(
    client, db_session, monkeypatch
):
    """The warning state must not break anything.

    If a newly created owner is prompted but still blocked, the feature ships
    broken and gets disabled.
    """
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", True)
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 7)
    make_privileged(db_session)

    response = login(client, "boss", "Str0ngPassword!")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body.get("2fa_enrollment_required") is None
    assert "2fa_enrollment_due" in body, (
        "the client is not told to prompt, so the grace period is invisible"
    )
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200


def test_first_login_is_stamped_on_sign_in(client, db_session, monkeypatch):
    """The anchor has to be written, or the grace period never starts.

    Without this the `created_at` fallback is used forever, and an account
    created by a seed script can never accumulate enough age to be blocked --
    which is to say enforcement quietly never applies to seeded accounts.
    """
    from app.models.user import User

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", True)
    user = make_privileged(db_session)
    assert user.first_login_at is None

    login(client, "boss", "Str0ngPassword!")

    db_session.expire_all()
    stamped = db_session.query(User).filter(User.username == "boss").one().first_login_at
    assert stamped is not None
    # SQLite hands back a naive datetime and Postgres an aware one for this
    # column, so the assertion normalises through the same helper the policy
    # uses rather than assuming a dialect.
    normalized = totp_enforcement._as_utc(stamped)
    assert normalized is not None
    assert abs((datetime.now(timezone.utc) - normalized).total_seconds()) < 120


def test_a_cashier_is_never_prompted(client, db_session, monkeypatch):
    """A cashier should not see an enrolment prompt at all.

    The frontend keys off `2fa_enrollment_due`; if that appeared for every role
    the setting would be noise, and noise gets ignored.
    """
    from tests.helpers import make_user

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", True)
    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 0)
    make_user(db_session, username="frontdesk", password="Str0ngPassword!", role="cashier")

    response = login(client, "frontdesk", "Str0ngPassword!")
    assert response.status_code == 200
    assert response.json().get("2fa_enrollment_due") is None


def test_the_kill_switch_lets_a_blocked_owner_back_in(client, db_session, monkeypatch):
    """The emergency path, exercised end to end.

    An owner who loses their phone and has no recovery code has exactly one way
    back in. If this does not work, the switch is theoretical and the operator
    finds out at the worst possible moment.
    """
    from app.models.user import User

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 0)
    user = make_privileged(db_session)
    user.first_login_at = datetime.now(timezone.utc) - timedelta(days=30)
    db_session.commit()

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", True)
    blocked = login(client, "boss", "Str0ngPassword!")
    assert blocked.json().get("2fa_enrollment_required") is True

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENFORCEMENT_ENABLED", False)
    recovered = login(client, "boss", "Str0ngPassword!")
    assert recovered.status_code == 200
    assert recovered.json().get("2fa_enrollment_required") is None
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {recovered.json()['access_token']}"},
    )
    assert me.status_code == 200

    db_session.expire_all()
    assert db_session.query(User).filter(User.username == "boss").one() is not None


def test_a_disabled_owner_is_still_refused_before_enrolment(
    client, db_session, monkeypatch
):
    """Ordering: the active check must precede the enrolment decision.

    Otherwise a disabled account is handed an enrolment token, sets a TOTP
    secret, and is one flag flip from a working privileged session.
    """
    from tests.helpers import make_user

    monkeypatch.setattr(totp_enforcement.settings, "TOTP_ENROLLMENT_GRACE_DAYS", 0)
    make_user(
        db_session,
        username="exboss",
        password="Str0ngPassword!",
        role="owner",
        is_active=False,
    )
    response = login(client, "exboss", "Str0ngPassword!")
    assert response.status_code == 403
    assert "2fa_enrollment_required" not in response.json()
