from tests.helpers import auth_headers, make_user


def test_list_bookings_requires_auth(client):
    resp = client.get("/api/v1/bookings")
    assert resp.status_code in (401, 403)


def test_list_bookings_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/bookings", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_get_booking_not_found(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/bookings/999999", headers=auth_headers(client))
    assert resp.status_code == 404
