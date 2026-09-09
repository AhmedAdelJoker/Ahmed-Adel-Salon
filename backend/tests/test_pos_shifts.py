from tests.helpers import auth_headers, make_user


def test_current_shift_requires_auth(client):
    resp = client.get("/api/v1/pos-shifts/current")
    assert resp.status_code in (401, 403)


def test_current_shift_none_open(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/pos-shifts/current", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() is None


def test_list_shifts_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/pos-shifts", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_total_balance_no_shifts(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/pos-shifts/total-balance", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
