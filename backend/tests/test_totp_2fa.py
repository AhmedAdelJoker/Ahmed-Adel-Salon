"""TOTP two-factor auth — setup/enable/login-gate/disable flow."""
import pyotp

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
