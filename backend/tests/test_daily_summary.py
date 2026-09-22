from datetime import date
from decimal import Decimal

from app.models.customer import Customer
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.pos_shift import PosShift
from tests.helpers import auth_headers, make_user


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def _seed_customer(db_session, phone="01009998888"):
    customer = Customer(first_name="Sara", last_name="Test", phone=phone)
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


def _seed_invoice(db_session, customer_id, user_id, total, invoice_no, is_draft=False):
    from datetime import datetime

    invoice = Invoice(
        invoice_no=invoice_no,
        customer_id=customer_id,
        payment_method="cash",
        subtotal_amount=Decimal(str(total)),
        total_amount=Decimal(str(total)),
        created_by_user_id=user_id,
        is_draft=is_draft,
        created_at=datetime.now(),
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)
    return invoice


def _seed_shift(db_session, user_id, status="open"):
    from datetime import datetime

    shift = PosShift(user_id=user_id, status=status, opened_at=datetime.now())
    if status == "closed":
        shift.closed_at = datetime.now()
    db_session.add(shift)
    db_session.commit()
    db_session.refresh(shift)
    return shift


def _seed_expense(db_session, amount, description="قرطاسية"):
    from datetime import datetime

    expense = Expense(amount=float(amount), category="تشغيل", description=description, created_at=datetime.now())
    db_session.add(expense)
    db_session.commit()
    db_session.refresh(expense)
    return expense


def test_daily_summary_requires_auth(client):
    resp = client.get("/api/v1/pos-shifts/daily-summary")
    assert resp.status_code in (401, 403)


def test_daily_summary_forbidden_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.get(
        "/api/v1/pos-shifts/daily-summary", headers=auth_headers(client)
    )
    assert resp.status_code == 403


def test_daily_summary_allowed_for_accountant(client, db_session):
    make_user(db_session, username="acc1", role="accountant")
    resp = client.get(
        "/api/v1/pos-shifts/daily-summary",
        headers=auth_headers(client, username="acc1"),
    )
    assert resp.status_code == 200, resp.text


def test_daily_summary_empty(client, db_session):
    headers = _owner_headers(client, db_session)
    resp = client.get("/api/v1/pos-shifts/daily-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["date"] == date.today().isoformat()
    assert body["shifts"] == []
    assert body["expenses"] == []
    assert float(body["summary"]["total_sales"]) == 0
    assert body["summary"]["invoice_count"] == 0
    assert float(body["summary"]["total_expenses"]) == 0
    assert body["summary"]["shift_count"] == 0


def test_daily_summary_aggregates(client, db_session):
    owner = make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, username="owner1")
    customer = _seed_customer(db_session)
    _seed_invoice(db_session, customer.customer_id, owner.id, 100, "INV-DS-001")
    _seed_invoice(db_session, customer.customer_id, owner.id, 200, "INV-DS-002")
    _seed_shift(db_session, owner.id, status="closed")
    _seed_expense(db_session, 50)

    resp = client.get("/api/v1/pos-shifts/daily-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["summary"]["total_sales"]) == 300
    assert body["summary"]["invoice_count"] == 2
    assert float(body["summary"]["total_expenses"]) == 50
    assert body["summary"]["shift_count"] == 1
    assert len(body["shifts"]) == 1
    assert len(body["expenses"]) == 1
    assert body["expenses"][0]["description"] == "قرطاسية"


def test_daily_summary_excludes_drafts(client, db_session):
    owner = make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, username="owner1")
    customer = _seed_customer(db_session)
    _seed_invoice(db_session, customer.customer_id, owner.id, 100, "INV-DS-N1")
    _seed_invoice(db_session, customer.customer_id, owner.id, 9000, "INV-DS-D1", is_draft=True)

    resp = client.get("/api/v1/pos-shifts/daily-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["summary"]["total_sales"]) == 100
    assert body["summary"]["invoice_count"] == 1


def test_daily_summary_open_shift_live_sales(client, db_session):
    owner = make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, username="owner1")
    customer = _seed_customer(db_session)
    shift = _seed_shift(db_session, owner.id, status="open")
    # Stored totals are zero for open shifts — endpoint must compute live sales
    assert float(shift.total_sales or 0) == 0
    _seed_invoice(db_session, customer.customer_id, owner.id, 150, "INV-DS-L1")

    resp = client.get("/api/v1/pos-shifts/daily-summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["shifts"]) == 1
    row = body["shifts"][0]
    assert row["status"] == "open"
    assert float(row["total_sales"]) == 150
    assert row["invoice_count"] == 1
    assert row["user"]["username"] == "owner1"


def test_daily_summary_date_filter(client, db_session):
    headers = _owner_headers(client, db_session)
    today = date.today().isoformat()

    resp = client.get(
        "/api/v1/pos-shifts/daily-summary",
        params={"date_str": today},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["date"] == today

    resp = client.get(
        "/api/v1/pos-shifts/daily-summary",
        params={"date_str": "2000-01-01"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["summary"]["invoice_count"] == 0
    assert body["shifts"] == []


def test_daily_summary_invalid_date(client, db_session):
    headers = _owner_headers(client, db_session)
    resp = client.get(
        "/api/v1/pos-shifts/daily-summary",
        params={"date_str": "not-a-date"},
        headers=headers,
    )
    assert resp.status_code == 400
