"""POS shift auto-close: the over-age safety net (autoLockShiftHours).

The owner-facing control "ساعات القفل التلقائي للوردية" previously existed in
the financial-rules UI with no backend enforcement. It now acts as a safety
net on top of the working-hours closer:

- without working hours configured the old behaviour (never close) is kept,
  *unless* a forgotten shift has outlived ``autoLockShiftHours`` hours;
- during an active working window nothing closes before its time — except a
  shift that aged past the lock limit;
- outside the window the original grace-period logic is untouched, so the
  ordinary end-of-hours close still wins over the safety net wording.
"""
from datetime import timedelta
from decimal import Decimal

import pytest

import app.services.runtime_settings_service as runtime_settings_service
from app.core.clock import salon_now, utc_now_naive
from app.core.working_hours import DAY_KEYS, day_key
from app.models.business_settings import BusinessSettings
from app.models.pos_shift import PosShift
from app.services.pos_shift_service import auto_close_expired_shifts
from tests.helpers import make_user


@pytest.fixture(autouse=True)
def _isolated_runtime_settings(tmp_path, monkeypatch):
    monkeypatch.setattr(
        runtime_settings_service,
        "_RUNTIME_SETTINGS_PATH",
        tmp_path / "runtime_settings.json",
        raising=False,
    )


def _set_lock_hours(value):
    runtime_settings_service.update_runtime_settings(
        "financial_rules",
        {"autoLockShiftHours": value},
        {"autoLockShiftHours": 24},
    )


def _settings_row(db, *, working_hours=None):
    row = db.query(BusinessSettings).first()
    if row is None:
        row = BusinessSettings(salon_name="SalonPro", currency="EGP")
        db.add(row)
    row.working_hours = working_hours
    db.commit()
    db.refresh(row)
    return row


def _open_hours(db):
    """Settings row whose today's window is running right now."""
    now = salon_now()
    today_key = day_key(now.date())
    hours = {
        today_key: {
            "is_open": True,
            "open_time": (now - timedelta(hours=1)).strftime("%H:%M"),
            "close_time": (now + timedelta(hours=5)).strftime("%H:%M"),
        }
    }
    for day in DAY_KEYS:
        if day != today_key:
            hours[day] = {"is_open": False, "open_time": None, "close_time": None}
    return _settings_row(db, working_hours=hours)


def _closed_hours(db):
    """Settings row whose today's window ended two hours ago."""
    now = salon_now()
    today_key = day_key(now.date())
    hours = {
        today_key: {
            "is_open": True,
            "open_time": (now - timedelta(hours=3)).strftime("%H:%M"),
            "close_time": (now - timedelta(hours=2)).strftime("%H:%M"),
        }
    }
    for day in DAY_KEYS:
        if day != today_key:
            hours[day] = {"is_open": False, "open_time": None, "close_time": None}
    return _settings_row(db, working_hours=hours)


def _shift(db, user, *, opened_hours_ago):
    # UTC wall per the storage convention — the service ages shifts off UTC.
    shift = PosShift(
        user_id=user.id,
        status="open",
        opened_at=utc_now_naive() - timedelta(hours=opened_hours_ago),
        opening_cash=Decimal("100"),
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


def test_lock_hours_zero_hides_old_behaviour_without_working_hours(db_session):
    """No working hours + no lock rule → the pre-existing no-op."""
    _settings_row(db_session, working_hours=None)
    _set_lock_hours(0)
    user = make_user(db_session, username="autolock_cashier", role="cashier")
    shift = _shift(db_session, user, opened_hours_ago=5)

    closed = auto_close_expired_shifts(db_session)

    assert closed == 0
    assert db_session.get(PosShift, shift.id).status == "open"


def test_over_aged_shift_closes_even_without_working_hours(db_session):
    """The whole point: a forgotten shift outlives the net and gets sealed."""
    _settings_row(db_session, working_hours=None)
    _set_lock_hours(4)
    user = make_user(db_session, username="autolock_cashier", role="cashier")
    shift = _shift(db_session, user, opened_hours_ago=5)

    closed = auto_close_expired_shifts(db_session)

    assert closed == 1
    row = db_session.get(PosShift, shift.id)
    assert row.status == "closed"
    assert "احترازي" in (row.closing_note or "")
    assert "4 ساعة" in (row.closing_note or "")


def test_active_window_keeps_a_young_shift_open(db_session):
    _open_hours(db_session)
    _set_lock_hours(24)
    user = make_user(db_session, username="autolock_cashier", role="cashier")
    shift = _shift(db_session, user, opened_hours_ago=1)

    closed = auto_close_expired_shifts(db_session)

    assert closed == 0
    assert db_session.get(PosShift, shift.id).status == "open"


def test_active_window_closes_a_forgotten_shift(db_session):
    """Even mid-window, a shift past the lock limit is sealed with the note."""
    _open_hours(db_session)
    _set_lock_hours(24)
    user = make_user(db_session, username="autolock_cashier", role="cashier")
    shift = _shift(db_session, user, opened_hours_ago=25)

    closed = auto_close_expired_shifts(db_session)

    assert closed == 1
    row = db_session.get(PosShift, shift.id)
    assert row.status == "closed"
    assert "احترازي" in (row.closing_note or "")


def test_outside_window_grace_close_unchanged(db_session):
    """End-of-hours close keeps its wording and grace semantics."""
    _closed_hours(db_session)
    _set_lock_hours(0)
    user = make_user(db_session, username="autolock_cashier", role="cashier")
    shift = _shift(db_session, user, opened_hours_ago=3)

    closed = auto_close_expired_shifts(db_session)

    assert closed == 1
    row = db_session.get(PosShift, shift.id)
    assert row.status == "closed"
    assert "نهاية ساعات العمل" in (row.closing_note or "")


def test_master_toggle_disabled_stops_every_auto_close(db_session):
    """enableAutoShiftClose OFF means the scheduler never closes a shift —
    neither at end of hours nor through the over-age net."""
    _closed_hours(db_session)
    _set_lock_hours(4)
    runtime_settings_service.update_runtime_settings(
        "financial_rules",
        {"enableAutoShiftClose": False},
        {"enableAutoShiftClose": True, "autoLockShiftHours": 24},
    )
    user = make_user(db_session, username="autolock_cashier", role="cashier")
    shift = _shift(db_session, user, opened_hours_ago=30)

    closed = auto_close_expired_shifts(db_session)

    assert closed == 0
    assert db_session.get(PosShift, shift.id).status == "open"


def test_master_toggle_tolerates_a_hand_edited_string_value(db_session):
    """A runtime file edited by hand may hold "false" as a string — the
    master switch must still read it as off, not truthy."""
    _closed_hours(db_session)
    runtime_settings_service.update_runtime_settings(
        "financial_rules",
        {"enableAutoShiftClose": "false"},
        {"enableAutoShiftClose": True},
    )
    user = make_user(db_session, username="autolock_cashier", role="cashier")
    shift = _shift(db_session, user, opened_hours_ago=30)

    closed = auto_close_expired_shifts(db_session)

    assert closed == 0
    assert db_session.get(PosShift, shift.id).status == "open"
