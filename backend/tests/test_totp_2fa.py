"""TOTP two-factor auth — setup/enable/login-gate/disable flow + encryption at rest."""
import pyotp

from app.core.config import settings
from app.core.totp_crypto import encrypt_totp_secret
from app.models.activity_log import ActivityLog
from app.models.user import User
from tests.helpers import make_user


def _login(client, username="cashier1", password="Cashier123", totp=None):
    data = {"username": username, "password": password}
    if totp is not None:
        data["totp_code"] = totp
    return client.post("/api/v1/auth/login", data=data)


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_2fa(client, db_session):
    make_user(db_session)
    resp = _login(client)
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    headers = _auth_headers(token)
    setup = client.post("/api/v1/auth/2fa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    body = setup.json()
    assert body["secret"], "setup must return a TOTP secret"
    assert body["otpauth_url"].startswith("otpauth://totp/"), body["otpauth_url"]
    return headers, body["secret"]


def _wrong_code(secret):
    """A code guaranteed invalid right now (avoids 1-in-a-million flakiness)."""
    totp = pyotp.TOTP(secret)
    import time
    valid = {totp.at(int(time.time()) + 30 * k) for k in range(-5, 6)}
    for candidate in ("000000", "111111", "123456", "654321"):
        if candidate not in valid:
            return candidate
    raise AssertionError("could not find an invalid code")


def test_2fa_setup_returns_secret_and_url(client, db_session):
    _setup_2fa(client, db_session)


def test_2fa_login_gate_and_valid_code(client, db_session):
    headers, secret = _setup_2fa(client, db_session)

    enable = client.post(
        "/api/v1/auth/2fa/enable",
        json={"code": pyotp.TOTP(secret).now()},
        headers=headers,
    )
    assert enable.status_code == 200, enable.text

    # No code → 401 with machine-readable header.
    missing = _login(client)
    assert missing.status_code == 401, missing.text
    assert missing.headers.get("x-2fa-required") == "totp"

    # Wrong code → 401.
    bad = _login(client, totp=_wrong_code(secret))
    assert bad.status_code == 401, bad.text

    # Correct code → 200.
    good = _login(client, totp=pyotp.TOTP(secret).now())
    assert good.status_code == 200, good.text
    assert good.json()["access_token"]


def test_2fa_enable_rejects_wrong_code(client, db_session):
    headers, secret = _setup_2fa(client, db_session)
    resp = client.post(
        "/api/v1/auth/2fa/enable",
        json={"code": _wrong_code(secret)},
        headers=headers,
    )
    assert resp.status_code == 400, resp.text


def test_2fa_setup_rejected_when_already_enabled(client, db_session):
    headers, secret = _setup_2fa(client, db_session)
    enable = client.post(
        "/api/v1/auth/2fa/enable",
        json={"code": pyotp.TOTP(secret).now()},
        headers=headers,
    )
    assert enable.status_code == 200, enable.text
    again = client.post("/api/v1/auth/2fa/setup", headers=headers)
    assert again.status_code == 400, again.text


def test_2fa_disable_with_password_restores_simple_login(client, db_session):
    headers, secret = _setup_2fa(client, db_session)
    enable = client.post(
        "/api/v1/auth/2fa/enable",
        json={"code": pyotp.TOTP(secret).now()},
        headers=headers,
    )
    assert enable.status_code == 200, enable.text

    wrong = client.post(
        "/api/v1/auth/2fa/disable", json={"password": "Wrong123"}, headers=headers
    )
    assert wrong.status_code == 401, wrong.text

    disabled = client.post(
        "/api/v1/auth/2fa/disable", json={"password": "Cashier123"}, headers=headers
    )
    assert disabled.status_code == 200, disabled.text

    # Plain login works again (old token from before disable is stale; re-login).
    plain = _login(client)
    assert plain.status_code == 200, plain.text


# --- encryption at rest -------------------------------------------------------
# A TOTP seed cannot be hashed (the server must recompute codes), so it is
# encrypted instead. Storing it readable would hand anyone with database access
# a working 2FA bypass.


def _user_row(db_session, username="cashier1"):
    return db_session.query(User).filter(User.username == username).first()


def test_totp_secret_is_never_stored_plaintext(client, db_session):
    headers, secret = _setup_2fa(client, db_session)

    stored = _user_row(db_session).totp_secret
    assert stored, "secret must be persisted"
    assert stored != secret, "TOTP seed must not be stored in plaintext"
    assert secret not in stored, "plaintext seed must not appear inside the stored value"

    # The setup response still hands back the plaintext seed for the QR code.
    assert secret


def test_2fa_still_verifies_with_encrypted_secret(client, db_session):
    headers, secret = _setup_2fa(client, db_session)
    enable = client.post(
        "/api/v1/auth/2fa/enable",
        json={"code": pyotp.TOTP(secret).now()},
        headers=headers,
    )
    assert enable.status_code == 200, enable.text
    good = _login(client, totp=pyotp.TOTP(secret).now())
    assert good.status_code == 200, good.text


def test_legacy_plaintext_secret_verifies_and_is_upgraded(client, db_session):
    """Rows written before encryption existed must keep working, then migrate."""
    headers, secret = _setup_2fa(client, db_session)

    user = _user_row(db_session)
    user.totp_secret = secret  # simulate the pre-encryption row
    db_session.commit()
    assert _user_row(db_session).totp_secret == secret

    enable = client.post(
        "/api/v1/auth/2fa/enable",
        json={"code": pyotp.TOTP(secret).now()},
        headers=headers,
    )
    assert enable.status_code == 200, enable.text

    # Verifying rewrote the row as ciphertext. The request runs on its own
    # session, so drop the identity-map copy before re-reading.
    db_session.expire_all()
    upgraded = _user_row(db_session).totp_secret
    assert upgraded != secret, "legacy plaintext secret must be re-encrypted"
    assert secret not in upgraded

    assert _login(client, totp=pyotp.TOTP(secret).now()).status_code == 200


def test_undecryptable_secret_fails_closed_and_is_audited(client, db_session):
    """A seed encrypted under a rotated SECRET_KEY must not authenticate."""
    headers, secret = _setup_2fa(client, db_session)
    enable = client.post(
        "/api/v1/auth/2fa/enable",
        json={"code": pyotp.TOTP(secret).now()},
        headers=headers,
    )
    assert enable.status_code == 200, enable.text

    original = settings.SECRET_KEY
    try:
        # Ciphertext from a *different* key — what a SECRET_KEY rotation leaves behind.
        settings.SECRET_KEY = "a-totally-different-secret-key-32chars"
        alien = encrypt_totp_secret(secret)
    finally:
        settings.SECRET_KEY = original
    assert alien != secret

    user = _user_row(db_session)
    user.totp_secret = alien
    db_session.commit()

    resp = _login(client, totp=pyotp.TOTP(secret).now())
    assert resp.status_code == 401, resp.text

    reasons = [
        (log.description or "")
        for log in db_session.query(ActivityLog).all()
    ]
    assert any("totp_secret_undecryptable" in r for r in reasons), reasons
