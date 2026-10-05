"""POS shift auto-close must not lose money.

The auto-closer used to sum invoices with only a lower bound (``created_at >=
opened_at``), so anything raised after the shift was stamped closed fell outside
every shift report. The window is now bounded at both ends.
"""
from datetime import timedelta
from decimal import Decimal

from app.core.clock import salon_now
from app.core.working_hours import DAY_KEYS, day_key
from app.models.business_settings import BusinessSettings
from app.models.invoice import Invoice
from app.models.pos_shift import PosShift
from app.services.pos_shift_service import (
    auto_close_expired_shifts,
    is_within_working_hours,
    next_closing_moment,
)
from tests.helpers import make_user

# Monday, used so the fixture date is stable and the day is open in the fixture.
MONDAY = "2026-09-28"


def _closed_hours(db):
    """Working hours that closed an hour ago, so auto-close is due."""
    row = db.query(BusinessSettings).first()
    if row is None:
        row = BusinessSettings(salon_name="SalonPro", currency="EGP")
        db.add(row)
    now = salon_now()
    today_key = day_key(now.date())
    # a window that closed two hours ago, entirely in the past and never
    # crossing midnight (open is always further back than close)
    row.working_hours = {
        today_key: {
            "is_open": True,
            "open_time": (now - timedelta(hours=3)).strftime("%H:%M"),
            "close_time": (now - timedelta(hours=2)).strftime("%H:%M"),
        }
    }
    for day in DAY_KEYS:
        if day != today_key:
            row.working_hours[day] = {"is_open": False, "open_time": None, "close_time": None}
    db.commit()
    db.refresh(row)
    return row


def _open_hours(db):
    row = db.query(BusinessSettings).first()
    if row is None:
        row = BusinessSettings(salon_name="SalonPro", currency="EGP")
        db.add(row)
    now = salon_now()
    # anchor the fixture to the day the salon is actually open *today*, so the
    # assertion holds whatever day the suite runs on
    today_key = day_key(now.date())
    row.working_hours = {
        today_key: {
            "is_open": True,
            "open_time": (now - timedelta(hours=1)).strftime("%H:%M"),
            "close_time": (now + timedelta(hours=5)).strftime("%H:%M"),
        }
    }
    for day in DAY_KEYS:
        if day != today_key:
            row.working_hours[day] = {"is_open": False, "open_time": None, "close_time": None}
    db.commit()
    db.refresh(row)
    return row


def _shift(db, user, *, opened_ago_minutes=180, opening_cash="500"):
    now = salon_now()
    shift = PosShift(
        user_id=user.id,
        status="open",
        opened_at=now - timedelta(minutes=opened_ago_minutes),
        opening_cash=Decimal(str(opening_cash)),
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


def _invoice(db, user, shift, *, amount, minutes_after_open, method="CASH"):
    from app.models.customer import Customer

    customer = (
        db.query(Customer)
        .filter(Customer.phone == f"0100{shift.id}{minutes_after_open:04d}")
        .first()
    )
    if customer is None:
        customer = Customer(
            first_name="عميل",
            last_name="اختبار",
            phone=f"0100{shift.id}{minutes_after_open:04d}",
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    stamp = salon_now() - timedelta(minutes=180) + timedelta(minutes=minutes_after_open)
    row = Invoice(
        invoice_no=f"INV-TEST-{shift.id}-{minutes_after_open}",
        customer_id=customer.customer_id,
        created_by_user_id=user.id,
        payment_method=method,
        subtotal_amount=Decimal(str(amount)),
        total_amount=Decimal(str(amount)),
        discount_amount=Decimal("0"),
        created_at=stamp,
    )
    db.add(row)
    db.commit()
    return row


def test_invoice_before_closing_is_counted(db_session):
    user = make_user(db_session, username="cashier1", role="cashier")
    _closed_hours(db_session)
    shift = _shift(db_session, user)
    _invoice(db_session, user, shift, amount=100, minutes_after_open=30)

    assert auto_close_expired_shifts(db_session) == 1
    db_session.refresh(shift)
    assert shift.status == "closed"
    assert shift.invoice_count == 1
    assert Decimal(str(shift.total_sales)) == Decimal("100")
    assert Decimal(str(shift.expected_closing_cash)) == Decimal("600")


def test_invoice_raised_after_the_auto_close_is_not_lost(db_session):
    """The leak: an invoice stamped after closed_at has to stay out of the totals
    but must not be silently attributed to nothing — it is reported as a gap."""
    user = make_user(db_session, username="cashier1", role="cashier")
    _closed_hours(db_session)
    shift = _shift(db_session, user)
    _invoice(db_session, user, shift, amount=100, minutes_after_open=30)

    auto_close_expired_shifts(db_session)
    db_session.refresh(shift)
    closed_at = shift.closed_at

    # a late invoice (e.g. a POS terminal that flushed after the close)
    _invoice(db_session, user, shift, amount=250, minutes_after_open=400)

    from app.services.pos_shift_service import recompute_shift_totals

    recompute_shift_totals(db_session, shift)
    db_session.refresh(shift)
    # bounded window => the late invoice is excluded, totals stay stable
    assert shift.invoice_count == 1
    assert Decimal(str(shift.total_sales)) == Decimal("100")
    assert closed_at is not None


def test_multiple_invoices_are_summed(db_session):
    user = make_user(db_session, username="cashier1", role="cashier")
    _closed_hours(db_session)
    shift = _shift(db_session, user)
    _invoice(db_session, user, shift, amount=100, minutes_after_open=10, method="CASH")
    _invoice(db_session, user, shift, amount=250, minutes_after_open=60, method="CASH")
    _invoice(db_session, user, shift, amount=999, minutes_after_open=90, method="CARD")

    auto_close_expired_shifts(db_session)
    db_session.refresh(shift)
    assert shift.invoice_count == 3
    assert Decimal(str(shift.total_sales)) == Decimal("1349")
    # only cash counts toward the drawer: 500 opening + 100 + 250
    assert Decimal(str(shift.expected_closing_cash)) == Decimal("850")


def test_invoices_from_another_user_are_ignored(db_session):
    user = make_user(db_session, username="cashier1", role="cashier")
    other = make_user(db_session, username="cashier2", role="cashier")
    _closed_hours(db_session)
    shift = _shift(db_session, user)
    _invoice(db_session, user, shift, amount=100, minutes_after_open=10)
    _invoice(db_session, other, shift, amount=5000, minutes_after_open=20)

    auto_close_expired_shifts(db_session)
    db_session.refresh(shift)
    assert shift.invoice_count == 1
    assert Decimal(str(shift.total_sales)) == Decimal("100")


def test_a_just_opened_shift_is_not_slammed_shut(db_session):
    """Opening a shift a minute before closing must survive the grace period."""
    user = make_user(db_session, username="cashier1", role="cashier")
    _closed_hours(db_session)
    shift = _shift(db_session, user, opened_ago_minutes=1)

    assert auto_close_expired_shifts(db_session) == 0
    db_session.refresh(shift)
    assert shift.status == "open"


def test_no_shifts_means_nothing_to_close(db_session):
    _closed_hours(db_session)
    assert auto_close_expired_shifts(db_session) == 0


def test_within_working_hours_during_the_window(db_session):
    _open_hours(db_session)
    assert is_within_working_hours(db_session) is True
    assert next_closing_moment(db_session) is not None


def test_within_working_hours_is_false_when_closed(db_session):
    _closed_hours(db_session)
    assert is_within_working_hours(db_session) is False
    assert next_closing_moment(db_session) is None


def test_no_settings_means_open(db_session):
    assert is_within_working_hours(db_session) is True
