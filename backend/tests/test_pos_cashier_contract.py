"""POS cashier contract: live shift stats + stock deduction on every invoice.

Covers the two P1 fixes from the POS audit:

1. `GET /pos-shifts/current/stats` must report the same expected-cash figure
   the close endpoint stamps (cash-only lower bound and cash expenses) — the
   client used to compute it from `total_sales`, which includes card + split
   sales, so the العجز/الزيادة indicator lied whenever a card sale existed.
2. `POST /invoices/manual` must deduct stock even when the appointment already
   has a ServiceSession; the old skip meant direct product items on
   session-based invoices never left the shelf.
"""
from datetime import date, time
from decimal import Decimal

from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.pos_shift import PosShift
from app.models.product import Product
from app.models.service import Service
from app.models.service_session import ServiceSession
from app.core.clock import utc_now_naive
from tests.helpers import auth_headers, make_user


def _seed_pos_fixture(db_session, *, phone="01110000001"):
    user = make_user(db_session, username="cashier_stats", role="cashier")
    customer = Customer(first_name="عميل", last_name="نقدي", phone=phone)
    barber = Employee(full_name="Barber Stats", phone_primary="01099910001", job_title="barber")
    db_session.add_all([customer, barber])
    db_session.commit()
    db_session.refresh(customer)
    db_session.refresh(barber)
    return user, customer, barber


def _open_shift(db_session, user, opening_cash="500"):
    shift = PosShift(
        user_id=user.id,
        status="open",
        opened_at=utc_now_naive(),
        opening_cash=Decimal(str(opening_cash)),
    )
    db_session.add(shift)
    db_session.commit()
    db_session.refresh(shift)
    return shift


def _seed_invoice(db_session, user, customer, *, amount, method, minutes_after_open=5):
    row = Invoice(
        invoice_no=f"INV-STATS-{user.id}-{minutes_after_open}-{method}",
        customer_id=customer.customer_id,
        created_by_user_id=user.id,
        payment_method=method,
        subtotal_amount=Decimal(str(amount)),
        total_amount=Decimal(str(amount)),
        discount_amount=Decimal("0"),
        created_at=utc_now_naive(),
    )
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    return row


def _stats(client, headers):
    return client.get("/api/v1/pos-shifts/current/stats", headers=headers)


def test_stats_reports_cash_only_expected(client, db_session):
    user, customer, _barber = _seed_pos_fixture(db_session)
    _open_shift(db_session, user, opening_cash="500")
    _seed_invoice(db_session, user, customer, amount=200, method="CASH")
    _seed_invoice(
        db_session, user, customer, amount=300, method="CARD", minutes_after_open=10
    )
    db_session.add(
        Expense(
            amount=50,
            category="supplies",
            payment_method="cash",
            status="approved",
            created_by_user_id=user.id,
            created_at=utc_now_naive(),
        )
    )
    db_session.commit()

    resp = _stats(client, auth_headers(client, username="cashier_stats"))

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["shift_id"] is not None
    stats = body["stats"]
    assert stats["cash_sales"] == 200.0
    assert stats["card_sales"] == 300.0
    assert stats["total_sales"] == 500.0
    assert stats["total_expenses"] == 50.0
    assert stats["cash_expenses"] == 50.0
    # 500 opening + 200 cash - 50 cash expenses (card sale must not inflate it)
    assert stats["expected_closing_cash"] == 650.0
    assert stats["invoice_count"] == 2


def test_stats_without_open_shift_returns_nulls(client, db_session):
    _seed_pos_fixture(db_session, phone="01110000002")

    resp = _stats(client, auth_headers(client, username="cashier_stats"))

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["shift_id"] is None
    assert body["stats"] is None


def test_manual_product_invoice_deducts_stock(client, db_session):
    user, customer, barber = _seed_pos_fixture(db_session, phone="01110000003")
    product = Product(name="Serum", quantity=Decimal("5"), sell_price=Decimal("50"))
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [
                {
                    "item_type": "product",
                    "product_id": product.id,
                    "quantity": 1,
                    "employee_id": None,
                    "unit_price": "50",
                }
            ],
        },
        headers=auth_headers(client, username="cashier_stats"),
    )

    assert resp.status_code == 200, resp.text
    db_session.refresh(product)
    assert float(product.quantity) == 4


def test_session_appointment_invoice_still_deducts_stock(client, db_session, monkeypatch):
    """The old skip: appointment with a ServiceSession → no deduction at all."""
    import app.api.v1.endpoints.invoices as invoices_module

    monkeypatch.setattr(
        invoices_module.manager,
        "publish",
        lambda payload: None,
    )
    """The old skip: appointment with a ServiceSession → no deduction at all."""
    user, customer, barber = _seed_pos_fixture(db_session, phone="01110000004")
    product = Product(name="Dye", quantity=Decimal("10"), sell_price=Decimal("80"))
    service = Service(name="Cut", price=Decimal("100"), duration_minutes=30)
    db_session.add_all([product, service])
    db_session.commit()
    db_session.refresh(product)
    db_session.refresh(service)

    appointment = Appointment(
        customer_id=customer.customer_id,
        barber_id=barber.id,
        appointment_date=date(2026, 10, 20),
        appointment_time=time(18, 0),
        status="completed",
        total_estimated_price=Decimal("100"),
        total_estimated_duration_minutes=30,
    )
    db_session.add(appointment)
    db_session.commit()
    db_session.refresh(appointment)

    session_row = ServiceSession(
        appointment_id=appointment.id,
        customer_id=customer.customer_id,
        barber_id=barber.id,
        status="active",
        total_price=Decimal("100"),
        created_by_user_id=user.id,
    )
    db_session.add(session_row)
    db_session.commit()

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "appointment_id": appointment.id,
            "items": [
                {
                    "item_type": "service",
                    "service_id": service.id,
                    "quantity": 1,
                    "employee_id": barber.id,
                    "unit_price": "100",
                },
                {
                    "item_type": "product",
                    "product_id": product.id,
                    "quantity": 1,
                    "employee_id": None,
                    "unit_price": "80",
                },
            ],
        },
        headers=auth_headers(client, username="cashier_stats"),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["total_amount"]) == 180
    db_session.refresh(product)
    # 10 - 1: the product must leave stock even though a session row exists
    assert float(product.quantity) == 9

    db_session.refresh(appointment)
    assert appointment.status == "done"


def test_session_invoice_stock_deduction_is_idempotent(client, db_session):
    user, customer, barber = _seed_pos_fixture(db_session, phone="01110000005")
    product = Product(name="Wax", quantity=Decimal("10"), sell_price=Decimal("40"))
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    _open_shift(db_session, user)
    first = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [
                {
                    "item_type": "product",
                    "product_id": product.id,
                    "quantity": 2,
                    "employee_id": None,
                    "unit_price": "40",
                }
            ],
        },
        headers=auth_headers(client, username="cashier_stats"),
    )
    assert first.status_code == 200, first.text
    first_id = first.json()["id"]
    db_session.refresh(product)
    assert float(product.quantity) == 8

    # The distribution agent that proves idempotency at the service layer is
    # already covered by test_inventory_idempotency; here we verify the ledger
    # through a direct replay so no double deduction is possible.
    from app.services.inventory_service import deduct_stock_for_invoice

    deduct_stock_for_invoice(
        db_session, invoice_id=first_id, created_by_user_id=user.id
    )
    db_session.refresh(product)
    assert float(product.quantity) == 8
