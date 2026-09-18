from tests.helpers import auth_headers, make_user
from app.models.customer import Customer


def _seed_customers(db_session):
    rows = [
        Customer(first_name="VIP", last_name="One", phone="01000000001", visits_count=20, lifetime_spend=5000),
        Customer(first_name="Regular", last_name="Two", phone="01000000002", visits_count=5, lifetime_spend=1000),
        Customer(first_name="New", last_name="Three", phone="01000000003", visits_count=0, lifetime_spend=0),
        Customer(first_name="Dup", last_name="Four", phone="01000000002", visits_count=1, lifetime_spend=100),
    ]
    db_session.add_all(rows)
    db_session.commit()
    return rows


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


def test_list_customers_pagination_and_total_header(client, db_session):
    make_user(db_session)
    _seed_customers(db_session)
    headers = auth_headers(client)
    page1 = client.get("/api/v1/customers", params={"limit": 2}, headers=headers)
    assert page1.status_code == 200, page1.text
    assert len(page1.json()) == 2
    assert page1.headers.get("x-total-count") == "4"
    page2 = client.get(
        "/api/v1/customers", params={"limit": 2, "offset": 2}, headers=headers
    )
    assert len(page2.json()) == 2
    ids1 = {c["customer_id"] for c in page1.json()}
    ids2 = {c["customer_id"] for c in page2.json()}
    assert ids1.isdisjoint(ids2)


def test_list_customers_skip_alias(client, db_session):
    make_user(db_session)
    _seed_customers(db_session)
    headers = auth_headers(client)
    resp = client.get(
        "/api/v1/customers", params={"limit": 2, "skip": 2}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 2
    assert resp.headers.get("x-total-count") == "4"


def test_list_customers_search_q(client, db_session):
    make_user(db_session)
    _seed_customers(db_session)
    headers = auth_headers(client)
    by_name = client.get("/api/v1/customers", params={"q": "vip"}, headers=headers)
    assert by_name.status_code == 200, by_name.text
    assert len(by_name.json()) == 1
    assert by_name.json()[0]["first_name"] == "VIP"
    by_phone = client.get(
        "/api/v1/customers", params={"q": "01000000003"}, headers=headers
    )
    assert len(by_phone.json()) == 1
    assert by_phone.json()[0]["first_name"] == "New"


def test_list_customers_segment_filter(client, db_session):
    make_user(db_session)
    _seed_customers(db_session)
    headers = auth_headers(client)
    vip = client.get("/api/v1/customers", params={"segment": "vip"}, headers=headers)
    assert [c["first_name"] for c in vip.json()] == ["VIP"]
    new = client.get("/api/v1/customers", params={"segment": "new"}, headers=headers)
    assert {c["first_name"] for c in new.json()} == {"New", "Dup"}
    regular = client.get(
        "/api/v1/customers", params={"segment": "regular"}, headers=headers
    )
    assert [c["first_name"] for c in regular.json()] == ["Regular"]


def test_customers_stats(client, db_session):
    make_user(db_session)
    _seed_customers(db_session)
    headers = auth_headers(client)
    resp = client.get("/api/v1/customers/stats", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 4
    assert body["vip_count"] == 1
    assert body["regular_count"] == 1
    assert body["new_count"] == 2
    assert body["avg_spend"] == round((5000 + 1000 + 0 + 100) / 4, 2)
    assert body["duplicate_group_count"] == 1
    assert body["duplicate_customer_count"] == 2


def test_customers_stats_requires_auth(client):
    resp = client.get("/api/v1/customers/stats")
    assert resp.status_code in (401, 403)
