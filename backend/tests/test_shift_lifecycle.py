from decimal import Decimal

from app.models.invoice import Invoice
from tests.helpers import auth_headers, make_user
from tests.test_dashboard import _seed_customer


def test_shift_open_current_close_roundtrip(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)

    opened = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 500}, headers=headers)
    assert opened.status_code == 200, opened.text
    shift_id = opened.json()["id"]

    current = client.get("/api/v1/pos-shifts/current", headers=headers)
    assert current.status_code == 200, current.text
    assert current.json()["id"] == shift_id

    closed = client.post(
        f"/api/v1/pos-shifts/{shift_id}/close",
        json={"countedCash": 500},
        headers=headers,
    )
    assert closed.status_code == 200, closed.text
    body = closed.json()
    assert body["shift"]["status"] == "closed"
    assert body["stats"]["cash_sales"] == 0
    assert body["shift"]["expected_closing_cash"] == 500

    current_after = client.get("/api/v1/pos-shifts/current", headers=headers)
    assert current_after.status_code == 200, current_after.text
    assert current_after.json() is None


def test_shift_double_open_rejected(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)

    first = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 100}, headers=headers)
    assert first.status_code == 200, first.text

    second = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 100}, headers=headers)
    assert second.status_code == 400


def test_shift_double_close_rejected(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)

    opened = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 100}, headers=headers)
    shift_id = opened.json()["id"]

    first_close = client.post(
        f"/api/v1/pos-shifts/{shift_id}/close", json={"countedCash": 100}, headers=headers
    )
    assert first_close.status_code == 200, first_close.text

    second_close = client.post(
        f"/api/v1/pos-shifts/{shift_id}/close", json={"countedCash": 100}, headers=headers
    )
    assert second_close.status_code == 400


def _seed_invoice(db_session, user_id, customer_id, total, invoice_no, payment_method="cash", is_draft=False):
    invoice = Invoice(
        invoice_no=invoice_no,
        customer_id=customer_id,
        payment_method=payment_method,
        subtotal_amount=Decimal(str(total)),
        total_amount=Decimal(str(total)),
        created_by_user_id=user_id,
        is_draft=is_draft,
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)
    return invoice


def test_close_with_cash_and_card_invoices(client, db_session):
    user = make_user(db_session)
    headers = auth_headers(client)
    customer = _seed_customer(db_session, phone="01008887777")

    opened = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 500}, headers=headers)
    assert opened.status_code == 200, opened.text
    shift_id = opened.json()["id"]

    _seed_invoice(db_session, user.id, customer.customer_id, 200, "INV-SHIFT-001", "cash")
    _seed_invoice(db_session, user.id, customer.customer_id, 300, "INV-SHIFT-002", "card")

    closed = client.post(
        f"/api/v1/pos-shifts/{shift_id}/close",
        json={"countedCash": 700},
        headers=headers,
    )
    assert closed.status_code == 200, closed.text
    body = closed.json()
    assert body["shift"]["status"] == "closed"
    assert body["shift"]["invoice_count"] == 2
    assert body["stats"]["cash_sales"] == 200
    assert body["stats"]["card_sales"] == 300
    assert body["shift"]["expected_closing_cash"] == 700
    assert body["shift"]["total_sales"] == 500


def test_close_excludes_draft_invoices(client, db_session):
    user = make_user(db_session)
    headers = auth_headers(client)
    customer = _seed_customer(db_session, phone="01005550000")

    opened = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 100}, headers=headers)
    assert opened.status_code == 200, opened.text
    shift_id = opened.json()["id"]

    _seed_invoice(db_session, user.id, customer.customer_id, 50, "INV-DRAFT-001", "cash")
    _seed_invoice(
        db_session, user.id, customer.customer_id, 10000, "INV-DRAFT-002", "cash", is_draft=True
    )

    closed = client.post(
        f"/api/v1/pos-shifts/{shift_id}/close",
        json={"countedCash": 150},
        headers=headers,
    )
    assert closed.status_code == 200, closed.text
    body = closed.json()
    assert body["shift"]["invoice_count"] == 1
    assert body["stats"]["cash_sales"] == 50
    assert body["shift"]["expected_closing_cash"] == 150


def test_close_missing_shift_returns_404(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/pos-shifts/999999/close", json={"countedCash": 0}, headers=auth_headers(client)
    )
    assert resp.status_code == 404
