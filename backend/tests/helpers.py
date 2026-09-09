"""Shared helpers for backend API tests."""
from app.core.security import get_password_hash
from app.models.user import User


def make_user(db_session, username="cashier1", password="Cashier123", role="cashier", is_active=True):
    user = User(
        username=username,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=is_active,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def login(client, username, password):
    return client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )


def auth_headers(client, username="cashier1", password="Cashier123"):
    resp = login(client, username, password)
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
