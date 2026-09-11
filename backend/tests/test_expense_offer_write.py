from tests.helpers import auth_headers, make_user
from tests.test_invoice_create import _seed_service


def test_create_expense_as_cashier_pending_audit(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.post(
        "/api/v1/expenses",
        json={"amount": 150, "category": "supplies"},
        headers=auth_headers(client),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending_audit"
    assert float(body["amount"]) == 150


def test_create_expense_as_owner_approved(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, username="owner1")
    resp = client.post(
        "/api/v1/expenses",
        json={"amount": 200, "category": "rent", "title": "Shop rent"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "approved"


def test_create_expense_validation(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/expenses",
        json={"amount": 0, "category": "supplies"},
        headers=auth_headers(client),
    )
    assert resp.status_code == 422


def test_approve_expense(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, username="owner1")
    created = client.post(
        "/api/v1/expenses",
        json={"amount": 75, "category": "supplies"},
        headers=headers,
    )
    assert created.status_code == 201, created.text

    make_user(db_session, username="cashier1", role="cashier")
    cashier_headers = auth_headers(client, username="cashier1")
    pending = client.post(
        "/api/v1/expenses",
        json={"amount": 60, "category": "supplies"},
        headers=cashier_headers,
    )
    expense_id = pending.json()["id"]

    approved = client.post(f"/api/v1/expenses/{expense_id}/approve", headers=headers)
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"


def test_create_offer_with_service(client, db_session):
    make_user(db_session)
    service = _seed_service(db_session)
    resp = client.post(
        "/api/v1/offers",
        json={"name": "Summer Deal", "offer_price": "80", "service_ids": [service.id]},
        headers=auth_headers(client),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Summer Deal"

    listed = client.get("/api/v1/offers", headers=auth_headers(client))
    assert listed.status_code == 200, listed.text
    assert any(o["name"] == "Summer Deal" for o in listed.json())


def test_create_offer_validation(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/offers",
        json={"name": "", "offer_price": "80"},
        headers=auth_headers(client),
    )
    assert resp.status_code == 422
