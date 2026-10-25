"""The commission list must not call a voided invoice "paid".

`invoices.is_closed` used to mean two things at once: the month was locked,
and this single invoice was cancelled. With the month lock in its own table
(`month_closures`), the flag means exactly one thing now: the invoice was
voided on its own. A commission row that reads `paid = is_closed` therefore
marked the cancelled invoice as paid and every real sale as pending.
"""
from datetime import datetime
from decimal import Decimal

from app.core.clock import salon_now
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.month_closure import MonthClosure
from app.models.user import User
from tests.helpers import auth_headers, make_user


def _barber(db_session, username):
    make_user(db_session, username=username, role="barber")
    user = db_session.query(User).filter(User.username == username).first()
    employee = Employee(
        full_name=f"Barber {username}",
        phone_primary=f"010{abs(hash(username)) % 10**10:010d}",
        job_title="barber",
        commission_rate=Decimal("15"),
    )
    db_session.add(employee)
    db_session.commit()
    user.barber_id = employee.id
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user, employee


def _invoice(db_session, customer, employee, invoice_no, total, is_closed=False, on=None):
    now = salon_now()
    invoice = Invoice(
        invoice_no=invoice_no,
        customer_id=customer.customer_id,
        barber_id=employee.id,
        payment_method="cash",
        subtotal_amount=Decimal(str(total)),
        total_amount=Decimal(str(total)),
        is_draft=False,
        is_closed=is_closed,
        # The first of the month by default, so the invoice is always inside the
        # current month's window no matter which day the suite runs on.
        created_at=on or datetime(now.year, now.month, 1, 12),
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)
    return invoice


def test_commission_rows_mark_voided_invoices_as_voided_not_paid(client, db_session):
    _user, employee = _barber(db_session, "commission_barber")
    headers = auth_headers(client, username="commission_barber")
    customer = Customer(first_name="Sara", last_name="Adel", phone="01000000009")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    _invoice(db_session, customer, employee, "INV-COM-PAID", 200, is_closed=False)
    _invoice(db_session, customer, employee, "INV-COM-VOIDED", 300, is_closed=True)

    resp = client.get("/api/v1/barber/commissions?period=month", headers=headers)
    assert resp.status_code == 200, resp.text
    rows = {row["invoice_no"]: row for row in resp.json()}

    assert rows["INV-COM-PAID"]["paid"] is True
    assert rows["INV-COM-PAID"]["voided"] is False
    assert rows["INV-COM-VOIDED"]["paid"] is False
    assert rows["INV-COM-VOIDED"]["voided"] is True


def test_pending_commission_excludes_a_voided_invoice(client, db_session):
    _user, employee = _barber(db_session, "pending_barber")
    headers = auth_headers(client, username="pending_barber")
    customer = Customer(first_name="Mona", last_name="Adel", phone="01000000010")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    _invoice(db_session, customer, employee, "INV-PEND-KEPT", 1000, is_closed=False)
    _invoice(db_session, customer, employee, "INV-PEND-VOIDED", 1000, is_closed=True)

    resp = client.get("/api/v1/barber/earnings-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # 1000 of live sales at a 15% rate = 150 owed. The voided invoice is not
    # owed anything, so it must not appear in the pending figure.
    assert float(body["pending"]) == 150.0


def test_voided_invoice_is_excluded_from_the_month_figure(client, db_session):
    """A cancelled invoice earns no commission, so it must not inflate the month."""
    _user, employee = _barber(db_session, "month_barber")
    headers = auth_headers(client, username="month_barber")
    customer = Customer(first_name="Hoda", last_name="Adel", phone="01000000011")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    _invoice(db_session, customer, employee, "INV-MONTH-KEPT", 1000, is_closed=False)
    _invoice(db_session, customer, employee, "INV-MONTH-VOIDED", 1000, is_closed=True)
    # Two more dated today, so the payment breakdown (a today-only figure) can
    # be checked as well.
    now = salon_now()
    _invoice(db_session, customer, employee, "INV-TODAY-KEPT", 500, on=now)
    _invoice(db_session, customer, employee, "INV-TODAY-VOIDED", 700, is_closed=True, on=now)

    resp = client.get("/api/v1/barber/earnings-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["month"]) == 225.0
    assert float(body["total_sales"]) == 1500.0
    # The cash bucket is today's live sales only: the voided invoice is out.
    assert float(body["cash"]) == 500.0


def test_a_voided_commission_row_carries_no_commission(client, db_session):
    """The rows must not sum to more than the summary reports for the period."""
    _user, employee = _barber(db_session, "rows_barber")
    headers = auth_headers(client, username="rows_barber")
    customer = Customer(first_name="Nour", last_name="Adel", phone="01000000012")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    _invoice(db_session, customer, employee, "INV-ROW-KEPT", 1000, is_closed=False)
    _invoice(db_session, customer, employee, "INV-ROW-VOIDED", 1000, is_closed=True)

    resp = client.get("/api/v1/barber/commissions?period=month", headers=headers)
    assert resp.status_code == 200, resp.text
    rows = {row["invoice_no"]: row for row in resp.json()}
    assert float(rows["INV-ROW-KEPT"]["commission"]) == 150.0
    assert float(rows["INV-ROW-VOIDED"]["commission"]) == 0.0


def test_pending_drops_to_zero_once_the_month_is_locked(client, db_session):
    """A month locked in the archive is settled, so nothing is pending on it."""
    _user, employee = _barber(db_session, "locked_barber")
    headers = auth_headers(client, username="locked_barber")
    customer = Customer(first_name="Salma", last_name="Adel", phone="01000000013")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    _invoice(db_session, customer, employee, "INV-LOCKED-KEPT", 1000, is_closed=False)

    now = salon_now()
    db_session.add(
        MonthClosure(
            year=now.year,
            month=now.month,
            closed_at=now,
            invoice_count=1,
            total_amount=Decimal("1000"),
        )
    )
    db_session.commit()

    resp = client.get("/api/v1/barber/earnings-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["pending"]) == 0.0
    # The month's earnings themselves are untouched by the lock.
    assert float(body["month"]) == 150.0
