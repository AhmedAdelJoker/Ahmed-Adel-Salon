from tests.helpers import auth_headers, make_user


def test_login_success(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "cashier1", "password": "Cashier123"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_wrong_password(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "cashier1", "password": "WrongPass1"},
    )
    assert resp.status_code == 401


def test_login_unknown_user(client):
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "ghost", "password": "Whatever123"},
    )
    assert resp.status_code == 401


def test_login_inactive_user(client, db_session):
    make_user(db_session, is_active=False)
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "cashier1", "password": "Cashier123"},
    )
    assert resp.status_code == 403


def test_me_with_token(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)
    resp = client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == "cashier1"


def test_me_without_token(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)
