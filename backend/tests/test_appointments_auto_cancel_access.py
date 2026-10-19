"""POST /appointments/auto-cancel-expired — gate width.

Regression context: the bookings board fires this sweep on load, but it was
gated require_manage_appointments while create/update/status/delete of the very
same appointments only require cashier-level access. Cashiers (the people who
run the desk) got 403 on every board load and expired holds were never swept
from their session.
"""
from tests.helpers import auth_headers, make_user


def _headers(client, db_session, username, role):
    make_user(db_session, username=username, role=role)
    return auth_headers(client, username=username)


def test_auto_cancel_requires_auth(client):
    resp = client.post("/api/v1/appointments/auto-cancel-expired")
    assert resp.status_code in (401, 403)


def test_auto_cancel_allowed_for_cashier(client, db_session):
    headers = _headers(client, db_session, "cashier1", "cashier")
    resp = client.post("/api/v1/appointments/auto-cancel-expired", headers=headers)
    assert resp.status_code == 200, resp.text
    assert "cancelled_count" in resp.json()


def test_auto_cancel_allowed_for_manager_and_owner(client, db_session):
    manager_headers = _headers(client, db_session, "manager1", "manager")
    resp = client.post(
        "/api/v1/appointments/auto-cancel-expired", headers=manager_headers
    )
    assert resp.status_code == 200, resp.text

    owner_headers = _headers(client, db_session, "owner1", "owner")
    resp = client.post(
        "/api/v1/appointments/auto-cancel-expired", headers=owner_headers
    )
    assert resp.status_code == 200, resp.text


def test_auto_cancel_forbidden_for_barber(client, db_session):
    # Barbers must not bulk-cancel the whole board, only their own bookings.
    headers = _headers(client, db_session, "barber1", "barber")
    resp = client.post("/api/v1/appointments/auto-cancel-expired", headers=headers)
    assert resp.status_code == 403
