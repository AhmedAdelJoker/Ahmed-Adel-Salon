from tests.helpers import auth_headers, make_user


def test_list_products_requires_auth(client):
    resp = client.get("/api/v1/products")
    assert resp.status_code in (401, 403)


def test_list_products_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/products", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_get_product_not_found(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/products/999999", headers=auth_headers(client))
    assert resp.status_code == 404
