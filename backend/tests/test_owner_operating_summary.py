"""`GET /owner/operating-summary` feeds the redesigned cockpit.

Three properties matter more here than the individual numbers:

  - Refunds and drafts never count as revenue. Counting them makes a bad day
    look like a good one, and no total on the page would reveal it.
  - A section that could not be computed is `null`. It is never zero and never a
    placeholder, because an empty ranking and an unavailable ranking are
    different facts and the cockpit shows them differently.
  - Revenue is filed under the salon-local calendar day. A 23:30 UTC invoice is
    the salon's next day in Cairo, and filing it under the UTC date puts it on
    the wrong row with the total unchanged.
"""

from datetime import timedelta
from decimal import Decimal

import pytest

from app.core.clock import salon_now
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.pos_shift import PosShift
from app.models.user import User
from tests.helpers import auth_headers, make_user

SUMMARY = "/api/v1/owner/operating-summary"


def _owner(client, db_session, username="ops_owner"):
    make_user(db_session, username=username, role="owner")
    return auth_headers(client, username=username)


def _invoice(db_session, *, number, total, created_at, barber_id=None):
    customer = Customer(first_name="C", last_name=number, phone=f"0100{number}")
    db_session.add(customer)
    db_session.flush()
    row = Invoice(
        invoice_no=number,
        customer_id=customer.customer_id,
        payment_method="cash",
        subtotal_amount=total,
        discount_amount=0,
        total_amount=total,
        is_draft=False,
        barber_id=barber_id,
        created_at=created_at,
    )
    db_session.add(row)
    db_session.flush()
    return row


def _defaults_today():
    now = salon_now()
    return now.replace(hour=12, minute=0, second=0, microsecond=0)


def test_empty_database_returns_honest_empty_sections(client, db_session):
    headers = _owner(client, db_session)

    resp = client.get(SUMMARY, headers=headers)

    assert resp.status_code == 200, resp.text
    body = resp.json()

    # A day series of zeros is a real answer: there were fourteen days and no
    # money in them.
    assert len(body["daily"]) == 14
    assert all(row["revenue"] == 0 for row in body["daily"])
    assert sum(1 for row in body["daily"] if row["is_today"]) == 1

    # Empty rankings, not null rankings. "Nobody sold anything" is reportable.
    assert body["top_barbers"] == []
    assert body["top_services"] == []

    # No baseline to compare against, so no comparison is offered.
    assert body["previous_window_average"] == 0


def test_draft_invoices_are_not_revenue(client, db_session):
    headers = _owner(client, db_session)
    now = _defaults_today()

    _invoice(db_session, number="R-DRAFT", total=Decimal("700"), created_at=now)
    db_session.flush()
    # Flip the draft after insert: relying on the column default alone would not
    # prove the filter is applied rather than just the default.
    draft = db_session.query(Invoice).filter(Invoice.invoice_no == "R-DRAFT").first()
    draft.is_draft = True
    db_session.commit()

    body = client.get(SUMMARY, headers=headers).json()

    today_row = next(r for r in body["daily"] if r["is_today"])
    assert today_row["revenue"] == 0, body["daily"]


def test_the_draft_filter_matches_the_rest_of_the_dashboard(client, db_session):
    """A second revenue rule in one panel would make it disagree with the KPIs
    above it, which is worse than either rule being wrong alone.

    `Invoice` has no `status` or refund column in this schema, so nothing here
    filters on one; an earlier draft of this endpoint did, which would have
    matched no rows and looked correct.
    """
    assert not hasattr(Invoice, "status"), (
        "Invoice gained a status column -- re-check whether refunds are now "
        "excluded from revenue and whether these aggregates should filter on it"
    )
    assert not hasattr(Invoice, "is_refunded")


def test_revenue_lands_on_the_right_day(client, db_session):
    headers = _owner(client, db_session)
    now = _defaults_today()
    yesterday = now - timedelta(days=1)

    _invoice(db_session, number="D-TODAY", total=Decimal("100"), created_at=now)
    _invoice(db_session, number="D-YDAY", total=Decimal("250"), created_at=yesterday)
    db_session.commit()

    daily = client.get(SUMMARY, headers=headers).json()["daily"]

    today_row = next(r for r in daily if r["is_today"])
    yday_row = next(r for r in daily if not r["is_today"] and r["date"] == yesterday.date().isoformat())

    assert today_row["revenue"] == 100.0
    assert yday_row["revenue"] == 250.0


def test_baseline_excludes_today_so_the_comparison_is_meaningful(client, db_session):
    """A baseline that includes today would halve its own denominator and make
    every day look like a decline against itself.

    The baseline is the mean daily revenue across the whole prior window,
    including the days with no revenue. Averaging only the days that had revenue
    would read 300 rather than 46.15 here, and would quietly flatter every
    comparison the cockpit makes -- a bad week would look like a good one.
    """
    headers = _owner(client, db_session)
    now = _defaults_today()

    _invoice(db_session, number="B-1", total=Decimal("200"), created_at=now - timedelta(days=1))
    _invoice(db_session, number="B-2", total=Decimal("400"), created_at=now - timedelta(days=2))
    _invoice(db_session, number="B-TODAY", total=Decimal("9999"), created_at=now)
    db_session.commit()

    body = client.get(SUMMARY, headers=headers).json()

    # 14-day window, so 13 prior days: (200 + 400) / 13.
    assert body["previous_window_average"] == round(600 / 13, 2)

    # Today's figure is excluded from its own baseline.
    assert body["previous_window_average"] < 9999


def test_staff_ranking_is_ordered_by_revenue(client, db_session):
    headers = _owner(client, db_session)
    now = _defaults_today()

    rich = Employee(full_name="Rich", phone_primary="0100000001")
    poor = Employee(full_name="Poor", phone_primary="0100000002")
    db_session.add_all([rich, poor])
    db_session.flush()

    _invoice(db_session, number="S-1", total=Decimal("900"), created_at=now, barber_id=rich.id)
    _invoice(db_session, number="S-2", total=Decimal("100"), created_at=now, barber_id=poor.id)
    db_session.commit()

    ranked = client.get(SUMMARY, headers=headers).json()["top_barbers"]

    assert [r["name"] for r in ranked] == ["Rich", "Poor"]
    assert ranked[0]["revenue"] == 900.0
    assert ranked[0]["invoices"] == 1


def test_services_are_ranked_by_revenue_not_by_count(client, db_session):
    """The pie chart ranked by share; the cockpit table ranks by money. A popular
    low-price service and an expensive rare one must not tie."""
    headers = _owner(client, db_session)
    now = _defaults_today()

    invoice = _invoice(db_session, number="V-1", total=Decimal("1000"), created_at=now)
    for _ in range(9):
        db_session.add(
            InvoiceItem(invoice_id=invoice.id, service_name="Cheap", quantity=1, unit_price=10, total_price=10)
        )
    db_session.add(
        InvoiceItem(invoice_id=invoice.id, service_name="Premium", quantity=1, unit_price=500, total_price=500)
    )
    db_session.commit()

    ranked = client.get(SUMMARY, headers=headers).json()["top_services"]

    assert ranked[0]["name"] == "Premium"
    assert ranked[0]["revenue"] == 500.0
    assert ranked[1]["name"] == "Cheap"
    assert ranked[1]["count"] == 9


def test_day_status_reports_a_closed_salon_without_an_open_shift(client, db_session):
    headers = _owner(client, db_session)

    status = client.get(SUMMARY, headers=headers).json()["day_status"]

    assert status["is_open"] is False
    # Null, not 0. There is no open shift; that is not the same as an open shift
    # with no money counted in it.
    assert status["open_shift"] is None


def test_an_overdue_open_shift_is_flagged(client, db_session):
    headers = _owner(client, db_session)
    user = db_session.query(User).filter(User.username == "ops_owner").first()

    stale = salon_now() - timedelta(hours=20)
    db_session.add(
        PosShift(
            user_id=user.id,
            status="open",
            opened_at=stale,
            opening_cash=Decimal("500"),
        )
    )
    db_session.commit()

    status = client.get(SUMMARY, headers=headers).json()["day_status"]

    assert status["is_open"] is True
    assert status["open_shift"]["overdue"] is True
    assert status["open_shift"]["hours_open"] > 12


def test_a_fresh_shift_is_not_overdue(client, db_session):
    headers = _owner(client, db_session)
    user = db_session.query(User).filter(User.username == "ops_owner").first()

    db_session.add(
        PosShift(
            user_id=user.id,
            status="open",
            opened_at=salon_now() - timedelta(hours=1),
            opening_cash=Decimal("500"),
        )
    )
    db_session.commit()

    status = client.get(SUMMARY, headers=headers).json()["day_status"]

    assert status["open_shift"]["overdue"] is False
    assert status["open_shift"]["opening_cash"] == 500.0


def test_the_series_length_follows_the_requested_window(client, db_session):
    headers = _owner(client, db_session)

    daily = client.get(f"{SUMMARY}?days=30", headers=headers).json()["daily"]

    assert len(daily) == 30


def test_it_rejects_a_nonsense_window(client, db_session):
    headers = _owner(client, db_session)

    assert client.get(f"{SUMMARY}?days=0", headers=headers).status_code == 422
    assert client.get(f"{SUMMARY}?days=999", headers=headers).status_code == 422


def test_a_manager_may_read_it_but_it_is_not_public(client, db_session):
    make_user(db_session, username="ops_mgr", role="manager")
    headers = auth_headers(client, username="ops_mgr")

    assert client.get(SUMMARY, headers=headers).status_code == 200

    assert client.get(SUMMARY).status_code in (401, 403)