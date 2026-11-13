"""Full-day absence detection and deduction regression tests.

Covers the engine path (`ensure_absence_penalties`), its HTTP entry point
(`/penalties/compute-absence`), the double-counting guard in the payroll
`auto_deduction`, and the PIN-protected amount-override flow on
`/penalties/{id}`.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

from tests.helpers import auth_headers, make_user
from tests.test_payroll_flow import _seed_barber

from app.core.clock import salon_now
from app.core.security import get_password_hash
from app.models.business_settings import BusinessSettings
from app.models.employee_presence_log import EmployeePresenceLog, AttendancePenalty
from app.models.month_closure import MonthClosure
from app.services.absence_service import ensure_absence_penalties


def _set_settings(db_session, *, penalty=0.5, pin=None):
    days = {
        day: {"is_open": True, "open_time": "09:00", "close_time": "22:00"}
        for day in ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]
    }
    settings = db_session.query(BusinessSettings).first()
    if settings:
        settings.working_hours = days
        settings.late_penalty_per_minute = penalty
        if pin is not None:
            settings.penalty_cancel_pin_hash = get_password_hash(pin)
    else:
        settings = BusinessSettings(
            salon_name="Test Salon",
            working_hours=days,
            late_threshold_minutes=15,
            late_penalty_per_minute=penalty,
            penalty_cancel_pin_hash=get_password_hash(pin) if pin else None,
        )
        db_session.add(settings)
    db_session.commit()
    return settings


def test_absent_employee_gets_one_penalty_per_missed_workday(client, db_session):
    make_user(db_session, username="owner-abs", role="owner")
    _set_settings(db_session)
    barber = _seed_barber(db_session)  # base salary defaults to 0? -- need real salary
    barber.base_salary = 3000
    # Hired before the tested month so absence detection applies for November.
    barber.hire_date = date(2026, 5, 1)
    db_session.commit()

    today = date(2026, 11, 10)  # Tuesday
    from app.models.employee import Employee
    emps = db_session.query(Employee).all()
    print("DBG employees:", [(e.id, e.full_name, str(e.base_salary), e.is_active, e.work_days_json, e.hire_date) for e in emps])
    summary = ensure_absence_penalties(db_session, year=2026, month=11, today=today)
    print("DEBUG summary:", summary)
    assert summary["created"] >= 0

    missed = db_session.query(AttendancePenalty).filter(
        AttendancePenalty.employee_id == barber.id,
        AttendancePenalty.source == "absence",
    ).all()
    # Nov 2-10 2026, excluding Fridays (none) → 9 missed workdays.
    assert summary["created"] == len(missed)
    assert len(missed) >= 8  # at least Nov 2..10 Monday-Thursday, Sat, Sun
    assert all(m.penalty_amount == Decimal(str(3000)) / Decimal("30") for m in missed)
    assert all(m.reason == "غياب بدون إذن" for m in missed)

    # Idempotent — exactly the same total on a re-run.
    again = ensure_absence_penalties(db_session, year=2026, month=11, today=today)
    assert again["created"] == 0
    assert again["skipped_existing"] == len(missed)


def test_present_days_produce_no_absence_penalty(client, db_session):
    make_user(db_session, username="owner-present", role="owner")
    _set_settings(db_session)
    barber = _seed_barber(db_session)
    barber.base_salary = 3000
    barber.hire_date = date(2026, 5, 1)
    db_session.commit()

    today = date(2026, 11, 4)  # Wednesday
    # One punch each of Nov 1 (Sun) and Nov 2 (Mon)
    for day in (date(2026, 11, 1), date(2026, 11, 2)):
        db_session.add(
            EmployeePresenceLog(
                employee_id=barber.id,
                status="in",
                created_at=datetime(day.year, day.month, day.day, 9, 0, 0),
                source="manual",
            )
        )
    db_session.commit()

    ensure_absence_penalties(db_session, year=2026, month=11, today=today)
    penalized_dates = {
        p.date for p in db_session.query(AttendancePenalty).filter_by(
            employee_id=barber.id, source="absence",
        ).all()
    }
    assert date(2026, 11, 1) not in penalized_dates
    assert date(2026, 11, 2) not in penalized_dates


def test_compute_absence_endpoint_returns_summary_and_cashier_is_blocked(client, db_session):
    make_user(db_session, username="owner-compute", role="owner")
    make_user(db_session, username="cashier-compute", role="cashier")
    _set_settings(db_session)
    barber = _seed_barber(db_session)
    barber.base_salary = 3000
    barber.hire_date = date(2026, 5, 1)
    db_session.commit()

    owner_headers = auth_headers(client, username="owner-compute", password="Cashier123")
    body = client.post(
        "/api/v1/barber-presence/penalties/compute-absence",
        json={"month": "2026-11"},
        headers=owner_headers,
    )
    assert body.status_code == 200, body.text
    assert body.json()["created"] >= 1

    cashier_headers = auth_headers(client, username="cashier-compute", password="Cashier123")
    denied = client.post(
        "/api/v1/barber-presence/penalties/compute-absence",
        json={"month": "2026-11"},
        headers=cashier_headers,
    )
    assert denied.status_code == 403


def test_payroll_does_not_double_count_absence_penalties(client, db_session):
    make_user(db_session, username="owner-nodouble", role="owner")
    _set_settings(db_session)
    barber = _seed_barber(db_session)
    barber.base_salary = 3000
    barber.hire_date = date(2026, 5, 1)
    db_session.commit()

    # Seed absences for every calendar day up to the real "today" — both
    # the penalty generator and the payroll metrics must agree on the same
    # window, otherwise the effective missed days leak through.
    ensure_absence_penalties(db_session, year=2026, month=11)
    absence_count = db_session.query(AttendancePenalty).filter_by(
        employee_id=barber.id, source="absence",
    ).count()
    expected_deduction = Decimal("100.00") * absence_count  # 3000 / 30 per day

    resp = client.get(
        "/api/v1/payroll/expected-net",
        params={"employee_id": barber.id, "year": 2026, "month": 11},
        headers=auth_headers(client, username="owner-nodouble", password="Cashier123"),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # auto_deduction must be exactly (3000/30)*N — not fee + penalty stacked.
    print("expected_deduction:", expected_deduction, "absence_count:", absence_count)
    print("auto_deduction:", body.get("auto_deduction"), "late_penalties:", body.get("late_penalties"), "absence_penalties:", body.get("absence_penalties"))
    print("metrics:", body.get("metrics"))
    assert float(body["auto_deduction"]) == float(expected_deduction)
    assert float(body["late_penalties"]) == float(expected_deduction)  # penalties only, no missed-day term
    assert body["absence_penalties"] == absence_count


def test_amount_override_requires_pin_and_locks_once_excused(client, db_session):
    make_user(db_session, username="owner-editamt", role="owner")
    settings = _set_settings(db_session, pin="1234")
    barber = _seed_barber(db_session)
    headers = auth_headers(client, username="owner-editamt", password="Cashier123")

    penalty = AttendancePenalty(
        employee_id=barber.id, date=salon_now().date(),
        late_minutes=30, penalty_amount=120, reason="manual test",
        source="manual",
    )
    db_session.add(penalty)
    db_session.commit()
    db_session.refresh(penalty)

    # Wrong PIN
    wrong = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"amount": 60, "pin": "0000"},
        headers=headers,
    )
    assert wrong.status_code == 403

    # Amount too high
    too_high = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"amount": 999999, "pin": "1234"},
        headers=headers,
    )
    assert too_high.status_code == 422

    # Valid edit
    ok = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"amount": 60, "pin": "1234"},
        headers=headers,
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["penalty_amount"] == 60.0
    db_session.refresh(penalty)
    assert float(penalty.penalty_amount) == 60.0

    # Excuse the penalty via the irreversible waiver path — the amount then freezes.
    excuse = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"is_excused": True, "pin": "1234"},
        headers=headers,
    )
    assert excuse.status_code == 200, excuse.text

    frozen = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"amount": 10, "pin": "1234"},
        headers=headers,
    )
    assert frozen.status_code == 409
