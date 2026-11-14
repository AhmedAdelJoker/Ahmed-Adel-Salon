"""End-to-end: does the cashier dashboard count the right shop day?

`test_timezone_windows.py` pins the helper. This pins the thing the helper is
for: an invoice recorded at 01:00 Cairo -- which is 22:00 UTC the previous day --
must appear in that shop day's takings.

The fixture writes `Invoice.created_at` the way SQLite does, via CURRENT_TIMESTAMP,
so the row is genuinely UTC rather than whatever Python local time would have
produced.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.core.clock import salon_day_bounds_utc, salon_timezone
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.user import User
from tests.helpers import auth_headers, make_user


@pytest.fixture
def shop(db_session):
    make_user(db_session, username="tz_manager", role="manager")
    cust = Customer(first_name="Tz", last_name="Test", phone="01000000009")
    db_session.add(cust)
    barber = Employee(full_name="Tz Barber", phone_primary="01000000008",
                      job_title="barber")
    db_session.add(barber)
    db_session.commit()
    db_session.refresh(cust)
    db_session.refresh(barber)
    return cust, barber


def _invoice_at(db_session, customer, barber, moment_utc: datetime,
                amount=Decimal("100.00"), invoice_no="TZ-1") -> Invoice:
    """Write created_at the way SQLite writes it: a naive UTC instant."""
    inv = Invoice(
        invoice_no=invoice_no,
        customer_id=customer.customer_id,
        barber_id=barber.id,
        subtotal_amount=amount,
        total_amount=amount,
        payment_method="cash",
        is_draft=False,
        is_closed=True,
        created_at=moment_utc,
    )
    db_session.add(inv)
    db_session.commit()
    db_session.refresh(inv)
    return inv


def _salon(moment_utc: datetime) -> datetime:
    return moment_utc.replace(tzinfo=timezone.utc).astimezone(salon_timezone())


class TestCashierSummaryCountsTheShopDay:
    def test_a_sale_after_midnight_cairo_counts_today(self, client, db_session, shop):
        """01:00 Cairo is 22:00 UTC the *previous* date.

        A UTC-midnight filter misses it entirely and a naive local-midnight filter
        also misses it, because both are anchored to 2026-10-11 00:00 UTC while
        the sale sits at 2026-10-10 22:00 UTC.
        """
        cust, barber = shop
        # The salon's current day, expressed the way the row is stored.
        day = _salon(datetime.now(timezone.utc).replace(tzinfo=None)).date()
        # One hour after the shop opened today, on the previous UTC date.
        sale_utc = (salon_day_bounds_utc(day)[0] + timedelta(hours=1))

        assert sale_utc.date() < day, "fixture must land on the previous UTC date"

        _invoice_at(db_session, cust, barber, sale_utc)

        resp = client.get(
            "/api/v1/dashboard/cashier-summary",
            headers=auth_headers(client, "tz_manager"),
        )
        assert resp.status_code == 200, resp.text
        assert float(resp.json()["today_sales"]) == 100.0, resp.json()

    def test_a_sale_from_yesterdays_late_shift_is_excluded(self, client, db_session, shop):
        cust, barber = shop
        day = _salon(datetime.now(timezone.utc).replace(tzinfo=None)).date()
        start_today = salon_day_bounds_utc(day)[0]
        # One minute before the shop opened today: yesterday's takings.
        _invoice_at(db_session, cust, barber, start_today - timedelta(minutes=1),
                    invoice_no="TZ-2")

        resp = client.get(
            "/api/v1/dashboard/cashier-summary",
            headers=auth_headers(client, "tz_manager"),
        )
        assert resp.status_code == 200, resp.text
        assert float(resp.json()["today_sales"]) == 0.0, resp.json()

    def test_two_todays_sales_add_up(self, client, db_session, shop):
        cust, barber = shop
        day = _salon(datetime.now(timezone.utc).replace(tzinfo=None)).date()
        start, end = salon_day_bounds_utc(day)
        _invoice_at(db_session, cust, barber, start + timedelta(hours=1),
                    amount=Decimal("40.00"), invoice_no="TZ-3")
        _invoice_at(db_session, cust, barber, end - timedelta(hours=1),
                    amount=Decimal("60.00"), invoice_no="TZ-4")

        resp = client.get(
            "/api/v1/dashboard/cashier-summary",
            headers=auth_headers(client, "tz_manager"),
        )
        assert resp.status_code == 200, resp.text
        assert float(resp.json()["today_sales"]) == 100.0, resp.json()

    def test_drafts_are_not_counted_as_sales(self, client, db_session, shop):
        cust, barber = shop
        day = _salon(datetime.now(timezone.utc).replace(tzinfo=None)).date()
        start = salon_day_bounds_utc(day)[0]
        inv = _invoice_at(db_session, cust, barber, start + timedelta(hours=1),
                          invoice_no="TZ-5")
        inv.is_draft = True
        db_session.commit()

        resp = client.get(
            "/api/v1/dashboard/cashier-summary",
            headers=auth_headers(client, "tz_manager"),
        )
        assert resp.status_code == 200, resp.text
        assert float(resp.json()["today_sales"]) == 0.0, resp.json()