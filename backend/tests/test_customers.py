from tests.helpers import auth_headers, make_user


def test_list_customers_requires_auth(client):
    resp = client.get("/api/v1/customers")
    assert resp.status_code in (401, 403)


def test_list_customers_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/customers", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_get_customer_not_found(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/customers/999999", headers=auth_headers(client))
    assert resp.status_code == 404
