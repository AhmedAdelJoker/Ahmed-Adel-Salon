"""Phase 3 smoke tests — verify security hardening works end-to-end."""
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.account_lockout import AccountLockout
from app.core.upload_security import sanitize_filename


def test_access_token_roundtrip():
    tok = create_access_token("ahmed")
    decoded = decode_token(tok, expected_type="access")
    assert decoded["sub"] == "ahmed"
    assert decoded["type"] == "access"
    assert decoded.get("jti"), "JWT must have a unique jti claim"


def test_refresh_token_type_isolated():
    ref = create_refresh_token("ahmed")
    decoded = decode_token(ref, expected_type="refresh")
    assert decoded["type"] == "refresh"

    # An access token MUST NOT pass refresh validation
    access = create_access_token("ahmed")
    try:
        decode_token(access, expected_type="refresh")
        raise AssertionError("expected access token to be rejected as refresh")
    except Exception:
        pass


def test_account_lockout_threshold():
    lo = AccountLockout(threshold=3, window_seconds=60, lockout_seconds=10)
    for _ in range(3):
        was_locked, _ = lo.record_failure("user:test")
    is_locked, retry = lo.is_locked("user:test")
    assert is_locked, "should be locked after threshold failures"
    assert retry > 0, "retry-after must be positive"


def test_account_lockout_resets_on_success():
    lo = AccountLockout(threshold=2, window_seconds=60, lockout_seconds=10)
    lo.record_failure("user:test")
    lo.record_failure("user:test")
    assert lo.is_locked("user:test")[0]
    lo.record_success("user:test")
    assert not lo.is_locked("user:test")[0]


def test_filename_sanitization():
    assert sanitize_filename("../../../etc/passwd") != "../../../etc/passwd"
    assert "/" not in sanitize_filename("subdir/file.png")
    assert "\\" not in sanitize_filename("subdir\\file.png")
    # Reserved Windows names
    assert sanitize_filename("CON.png").startswith("_")
    # Long filenames
    long = sanitize_filename("a" * 200 + ".jpg")
    assert len(long) <= 100
    # Empty
    assert sanitize_filename("") != ""
    # Unicode preserved
    assert sanitize_filename("اسم العميل.pdf").endswith(".pdf")


def test_settings_jwt_expiry_is_short():
    from app.core.config import settings
    # After Phase 3, access tokens must be ≤ 1 day
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES <= 60 * 24, (
        "Access token expiry too long for production"
    )


# ----------------------------------------------------------------------------
# Token revocation (denylist) — endpoint level
# ----------------------------------------------------------------------------
from tests.helpers import make_user, login  # noqa: E402


def _login_pair(client, username="cashier1", password="Cashier123"):
    resp = login(client, username, password)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["access_token"], body["refresh_token"]


def test_logout_revokes_access_token(client, db_session):
    make_user(db_session)
    access, _refresh = _login_pair(client)
    headers = {"Authorization": f"Bearer {access}"}

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    resp = client.post("/api/v1/auth/logout", json={}, headers=headers)
    assert resp.status_code == 200, resp.text

    # The same access token must now be rejected.
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_refresh_rotation_single_use(client, db_session):
    make_user(db_session)
    _access, refresh1 = _login_pair(client)

    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh1})
    assert resp.status_code == 200, resp.text
    refresh2 = resp.json()["refresh_token"]

    # The rotated (already used) refresh token must be rejected.
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh1})
    assert reuse.status_code == 401, reuse.text

    # The fresh one still works.
    again = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh2})
    assert again.status_code == 200, again.text


def test_change_password_invalidates_old_tokens(client, db_session):
    make_user(db_session, password="Cashier123")
    access1, _refresh = _login_pair(client, password="Cashier123")
    headers1 = {"Authorization": f"Bearer {access1}"}
    assert client.get("/api/v1/auth/me", headers=headers1).status_code == 200

    resp = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Cashier123", "new_password": "NewPass456"},
        headers=headers1,
    )
    assert resp.status_code == 200, resp.text

    # Old token (issued before the password change) must be rejected.
    assert client.get("/api/v1/auth/me", headers=headers1).status_code == 401

    # Login with the new password works.
    access2, _ = _login_pair(client, password="NewPass456")
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {access2}"}
        ).status_code
        == 200
    )
