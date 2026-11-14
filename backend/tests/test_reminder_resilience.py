"""Reminder batch must survive its first failure.

`send_due_reminders` used to commit everything once at the end and let a
sender's exception escape the loop. WhatsApp is real network I/O (60s timeout
per message), so one failing number meant: the remaining due appointments got
nothing for this tick, AND every message already delivered in the run lost its
sent-flag with the final rollback -- so the next tick sent those customers the
same message again. It also loaded the entire appointment history every
fifteen minutes and reminded customers about visits they had cancelled.

These tests talk to the service the way the scheduler does -- a session in,
calls recorded, senders faked -- and pin:
  * one failure cannot abort the appointments behind it,
  * flags of messages that were actually sent survive a later crash,
  * cancelled / no_show customers receive nothing,
  * the scan is prefiltered to the windows' dates.
"""

from datetime import date, time, timedelta
from decimal import Decimal

import pytest

from app.core.clock import salon_now
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.employee import Employee
from app.services import reminder_service


# --------------------------------------------------------------------------
# fixtures
# --------------------------------------------------------------------------

def _employee(db_session, tag="resil"):
    e = Employee(
        full_name=f"Barber {tag}",
        phone_primary=f"010{abs(hash(tag)) % 10**10:010d}",
        job_title="barber",
        commission_rate=Decimal("10"),
    )
    db_session.add(e)
    db_session.commit()
    db_session.refresh(e)
    return e


def _customer(db_session, tag="c1"):
    c = Customer(
        first_name="Ahmed",
        last_name=tag,
        phone=f"011{abs(hash(tag)) % 10**9:09d}",
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


def _appointment(db_session, customer, employee, *, hours_from_now, status="pending"):
    """An appointment `hours_from_now` ahead on the salon wall clock, rounded
    to whole minutes so `datetime.combine` reproduces it inside the window."""
    due = salon_now() + timedelta(hours=hours_from_now)
    a = Appointment(
        customer_id=customer.customer_id,
        barber_id=employee.id,
        appointment_date=due.date(),
        appointment_time=time(due.hour, due.minute),
        status=status,
        notes="pytest fixture",
        total_estimated_price=Decimal("0"),
        total_estimated_duration_minutes=30,
    )
    db_session.add(a)
    db_session.commit()
    db_session.refresh(a)
    return a


@pytest.fixture
def sent(monkeypatch):
    calls = []

    def record(kind):
        def stub(db, **kwargs):
            calls.append((kind, kwargs["appointment_id"]))

        return stub

    monkeypatch.setattr(reminder_service, "send_appointment_reminder_24h_template", record("24h"))
    monkeypatch.setattr(reminder_service, "send_appointment_reminder_2h_template", record("2h"))
    return calls


# --------------------------------------------------------------------------
# 1. one failure must not abort or un-send the batch
# --------------------------------------------------------------------------

def test_a_failed_send_skips_that_appointment_and_carries_on(client, db_session, sent, monkeypatch):
    """Three 24h-due appointments. The sender works, then fails, then works.

    The old loop raised on the second call: the third appointment got nothing
    this tick, and the first one lost its flag to the all-or-nothing commit --
    so the next tick messaged that customer again. Both halves are pinned.
    """
    employee = _employee(db_session, "fail_mid")
    one = _appointment(db_session, _customer(db_session, "fm1"), employee, hours_from_now=24)
    # One barber, one chair: three appointments in one slot is exactly what the
    # partial unique index on `appointments` now rejects. This test is about the
    # sender loop visiting three rows, so the rows go to three barbers.
    two = _appointment(
        db_session, _customer(db_session, "fm2"), _employee(db_session, "fail_mid_b"), hours_from_now=24
    )
    three = _appointment(
        db_session, _customer(db_session, "fm3"), _employee(db_session, "fail_mid_c"), hours_from_now=24
    )

    state = {"n": 0}

    def flaky(db, **kwargs):
        sent.append(("24h", kwargs["appointment_id"]))
        state["n"] += 1
        if state["n"] == 2:
            raise RuntimeError("simulated Meta API outage")

    monkeypatch.setattr(reminder_service, "send_appointment_reminder_24h_template", flaky)
    reminder_service.send_due_reminders(db_session)

    calls24 = [c for c in sent if c[0] == "24h"]
    assert sorted(aid for _, aid in calls24) == sorted(
        [one.id, two.id, three.id]
    ), "the appointments after the failure must still be attempted in this tick"

    db_session.expire_all()
    rows = {a.id: a for a in db_session.query(Appointment).all()}
    assert rows[one.id].reminder_24h_sent is True, (
        "the message that actually went out before the failure must keep its flag; "
        "otherwise the next tick re-sends it"
    )
    assert rows[two.id].reminder_24h_sent is False, "the failed one retries, never marked sent"
    assert rows[three.id].reminder_24h_sent is True


def test_a_late_crash_cannot_unsend_earlier_messages(client, db_session, sent, monkeypatch):
    """Two 24h-due appointments; the sender succeeds then dies hard.

    With the end-of-run commit the first flag was handed to the same rollback
    that swallowed the crash -- and the customer got the reminder twice. The
    flag has to be durable the moment the message went out.
    """
    employee = _employee(db_session, "late_crash")
    first = _appointment(db_session, _customer(db_session, "lc1"), employee, hours_from_now=24)
    # A second barber, for the reason given in the test above: two live
    # appointments cannot share one slot any more.
    _second = _appointment(
        db_session, _customer(db_session, "lc2"), _employee(db_session, "late_crash_b"), hours_from_now=24
    )

    def dies_outside_the_first(db, **kwargs):
        if kwargs["appointment_id"] != first.id:
            raise RuntimeError("simulated hard crash handling the second message")

    monkeypatch.setattr(reminder_service, "send_appointment_reminder_24h_template", dies_outside_the_first)
    reminder_service.send_due_reminders(db_session)

    db_session.expire_all()
    row = db_session.query(Appointment).filter(Appointment.id == first.id).first()
    assert row.reminder_24h_sent is True


# --------------------------------------------------------------------------
# 2. cancelled and no_show visits remind nobody
# --------------------------------------------------------------------------

def test_cancelled_and_no_show_receive_nothing(client, db_session, sent):
    """A reminder about a visit the customer cancelled is noise; the rows can
    sit inside the 24h window for days, so this used to fire a real message."""
    employee = _employee(db_session, "cancelled")
    control = _appointment(db_session, _customer(db_session, "cn_c"), employee, hours_from_now=24)
    cancelled = _appointment(
        db_session, _customer(db_session, "cn_x"), employee, hours_from_now=24, status="cancelled"
    )
    no_show = _appointment(
        db_session, _customer(db_session, "cn_n"), employee, hours_from_now=24, status="no_show"
    )

    reminder_service.send_due_reminders(db_session)

    touched = {aid for _, aid in sent}
    assert touched == {control.id}, sent

    db_session.expire_all()
    rows = {a.id: a for a in db_session.query(Appointment).all()}
    assert rows[cancelled.id].reminder_24h_sent is False
    assert rows[no_show.id].reminder_24h_sent is False


# --------------------------------------------------------------------------
# 3. the scan is prefiltered, not a whole-table walk
# --------------------------------------------------------------------------

def test_the_scan_is_bounded_to_the_window_dates(db_session, sent):
    """Every tick used to read the entire appointment history to find the
    handful of rows inside two future windows. The SQL must carry the date
    bounds, so a six-week-old row is never even seen."""
    employee = _employee(db_session, "bounded")
    due = _appointment(db_session, _customer(db_session, "b1"), employee, hours_from_now=24)

    old = Appointment(
        customer_id=due.customer_id,
        barber_id=employee.id,
        appointment_date=salon_now().date() - timedelta(days=45),
        appointment_time=time(12, 0),
        status="completed",
        notes="pytest fixture",
    )
    db_session.add(old)
    db_session.commit()

    reminder_service.send_due_reminders(db_session)

    assert sent == [("24h", due.id)], sent
    db_session.expire_all()
    stale = db_session.query(Appointment).filter(Appointment.id == old.id).first()
    assert stale.reminder_24h_sent is False


def test_the_sql_copies_the_prefilter_from_the_windows():
    """Behavioural tests pin what bounded rows do; this pins that the query
    itself carries the bounds, because the failure mode is invisible under
    small datasets -- the shop fills up and *then* every tick slows down."""
    import inspect
    import re

    src = inspect.getsource(reminder_service.send_due_reminders)
    assert re.search(r"appointment_date\.between\(", src), src
    assert "target_2h_from.date()" in src and "target_24h_to.date()" in src


# --------------------------------------------------------------------------
# 4. windows still behave (regression guard for the rewrite)
# --------------------------------------------------------------------------

def test_outside_both_windows_means_no_calls(client, db_session, sent):
    """An appointment 5 hours out is neither 2h nor 24h: nobody gets called."""
    employee = _employee(db_session, "outside")
    _appointment(db_session, _customer(db_session, "o1"), employee, hours_from_now=5)
    reminder_service.send_due_reminders(db_session)
    assert sent == [], sent


def test_the_2h_window_still_fires_right_before_the_visit(client, db_session, sent):
    employee = _employee(db_session, "late2h")
    apt = _appointment(db_session, _customer(db_session, "t2"), employee, hours_from_now=2)
    reminder_service.send_due_reminders(db_session)
    assert sent == [("2h", apt.id)], sent
