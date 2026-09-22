from decimal import Decimal

from app.models.customer import Customer
from app.models.invoice import Invoice
from tests.helpers import auth_headers, make_user


def _seed_customer(db_session, first_name="Sara", phone="01001234567", is_deleted=False):
    customer = Customer(
        first_name=first_name,
        last_name="Test",
        phone=phone,
        is_deleted=is_deleted,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


def _seed_invoice(db_session, customer_id, total, invoice_no, is_draft=False):
    from datetime import datetime

    invoice = Invoice(
        invoice_no=invoice_no,
        customer_id=customer_id,
        payment_method="cash",
        subtotal_amount=Decimal(str(total)),
        total_amount=Decimal(str(total)),
        is_draft=is_draft,
        created_at=datetime.now(),
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)
    return invoice


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def test_owner_summary_empty(client, db_session):
    resp = client.get("/api/v1/dashboard/owner-summary", headers=_owner_headers(client, db_session))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["customersCount"] == 0
    assert body["invoicesCount"] == 0
    assert body["totalRevenue"] == 0


def test_owner_summary_aggregates_seeds(client, db_session):
    headers = _owner_headers(client, db_session)
    c1 = _seed_customer(db_session, phone="01001111111")
    _seed_customer(db_session, first_name="Deleted", phone="01002222222", is_deleted=True)
    _seed_invoice(db_session, c1.customer_id, 100.50, "INV-TEST-001")
    _seed_invoice(db_session, c1.customer_id, 200.25, "INV-TEST-002")

    resp = client.get("/api/v1/dashboard/owner-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["customersCount"] == 1
    assert body["invoicesCount"] == 2
    assert body["totalRevenue"] == 300.75


def test_owner_summary_excludes_drafts(client, db_session):
    headers = _owner_headers(client, db_session)
    c1 = _seed_customer(db_session, phone="01006660000")
    _seed_invoice(db_session, c1.customer_id, 100, "INV-DASH-D1")
    _seed_invoice(db_session, c1.customer_id, 5000, "INV-DASH-D2", is_draft=True)

    resp = client.get("/api/v1/dashboard/owner-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["invoicesCount"] == 1
    assert body["totalRevenue"] == 100


def test_owner_summary_forbidden_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.get("/api/v1/dashboard/owner-summary", headers=auth_headers(client))
    assert resp.status_code == 403


def test_cashier_summary_counts_today(client, db_session):
    make_user(db_session, role="cashier")
    headers = auth_headers(client)
    c1 = _seed_customer(db_session, phone="01003333333")
    _seed_invoice(db_session, c1.customer_id, 50, "INV-TEST-003")

    resp = client.get("/api/v1/dashboard/cashier-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["customers_count"] == 1
    assert body["today_sales"] == 50
