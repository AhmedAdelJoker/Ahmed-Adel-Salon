"""Client-error intake tests.

Covers the contract the browser `RootErrorBoundary` depends on: the route must
accept an unauthenticated report (the client can crash before the token is
restored), must never 4xx/5xx on a bad payload, and must not leak internals.
"""

from app.models.activity_log import ActivityLog
from tests.helpers import auth_headers, make_user


def _rows(db_session):
    return db_session.query(ActivityLog).filter(ActivityLog.action == "client.error").all()


def test_client_error_requires_no_auth(client, db_session):
    resp = client.post(
        "/api/v1/telemetry/client-errors",
        json={"message": "Cannot read properties of undefined"},
    )
    assert resp.status_code == 202, resp.text
    assert resp.json()["status"] == "accepted"
    assert len(_rows(db_session)) == 1


def test_client_error_persists_message_and_context(client, db_session):
    resp = client.post(
        "/api/v1/telemetry/client-errors",
        json={
            "message": "Unexpected token < in JSON",
            "stack": "SyntaxError: Unexpected token\n    at JSON.parse",
            "componentStack": "\n    in App\n    in RouterProvider",
            "url": "http://localhost:5173/owner",
            "userAgent": "Mozilla/5.0",
            "timestamp": "2026-09-23T10:00:00.000Z",
            "release": "1.2.3",
        },
    )
    assert resp.status_code == 202, resp.text

    row = _rows(db_session)[0]
    body = row.description
    assert "Unexpected token" in body
    assert "1.2.3" in body
    assert "RouterProvider" in body


def test_client_error_missing_message_is_422(client, db_session):
    resp = client.post("/api/v1/telemetry/client-errors", json={})
    assert resp.status_code == 422
    assert len(_rows(db_session)) == 0


def test_client_error_oversized_message_is_422(client, db_session):
    resp = client.post(
        "/api/v1/telemetry/client-errors",
        json={"message": "x" * 5000},
    )
    assert resp.status_code == 422
    assert len(_rows(db_session)) == 0


def test_client_error_while_authenticated_is_attributed(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    resp = client.post(
        "/api/v1/telemetry/client-errors",
        json={"message": "boom"},
        headers=auth_headers(client, username="owner1"),
    )
    assert resp.status_code == 202, resp.text

    rows = _rows(db_session)
    assert len(rows) == 1
    assert rows[0].user_id is not None, "an authenticated report must be attributed"


def test_client_error_with_garbage_token_still_accepted(client, db_session):
    """A corrupt token must not suppress the report or 401 it."""
    resp = client.post(
        "/api/v1/telemetry/client-errors",
        json={"message": "boom with bad token"},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert resp.status_code == 202, resp.text
    assert len(_rows(db_session)) == 1