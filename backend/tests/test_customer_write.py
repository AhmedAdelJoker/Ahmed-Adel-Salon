from tests.helpers import auth_headers, make_user


def test_create_customer(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/customers",
        json={"first_name": "Sara", "last_name": "Ali", "phone": "01001234567"},
        headers=auth_headers(client),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["first_name"] == "Sara"
    assert body["customer_id"]

    listed = client.get("/api/v1/customers", headers=auth_headers(client))
    assert listed.status_code == 200, listed.text
    assert len(listed.json()) == 1


def test_create_customer_validation(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/customers",
        json={"first_name": "", "phone": "123"},
        headers=auth_headers(client),
    )
    assert resp.status_code == 422


def test_create_customer_requires_auth(client):
    resp = client.post(
        "/api/v1/customers",
        json={"first_name": "Sara", "phone": "01001234567"},
    )
    assert resp.status_code in (401, 403)
