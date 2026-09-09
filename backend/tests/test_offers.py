from tests.helpers import auth_headers, make_user


def test_list_offers_requires_auth(client):
    resp = client.get("/api/v1/offers")
    assert resp.status_code in (401, 403)


def test_list_offers_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/offers", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_list_active_offers_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/offers/active", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_get_offer_not_found(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/offers/999999", headers=auth_headers(client))
    assert resp.status_code == 404
