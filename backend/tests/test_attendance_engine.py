"""Regression tests for the attendance engine (F1–F4, F6–F8 fixes).

Covers the defects found during the /attendance pre-delivery inspection:

* the UI fingerprint card posted a JSON body to a query-param-only endpoint,
* Excel uploads crashed the import endpoints with 500 (decode of ZIP bytes),
* re-uploading the same sheet duplicated every row,
* a late check-in recorded no penalty row, and the penalty rate ignored
  BusinessSettings (the UI sent a value it never persisted),
* the history window that feeds archive/calendar/analytics never existed —
  those tabs were built from `/current`, which returns only today's logs.
"""

import io
from datetime import datetime, timedelta

import pytest

from tests.helpers import auth_headers, make_user
from tests.test_payroll_flow import _seed_barber

from app.models.business_settings import BusinessSettings
from app.models.employee_presence_log import EmployeePresenceLog, AttendancePenalty
from app.models.month_closure import MonthClosure
from app.core.clock import salon_now
from app.core.security import get_password_hash


def _seed_settings(db_session, *, open_time="09:00", close_time="22:00", late_threshold=15, penalty=0.5):
    days = {
        day: {"is_open": True, "open_time": open_time, "close_time": close_time}
        for day in ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]
    }
    settings = db_session.query(BusinessSettings).first()
    if settings:
        settings.working_hours = days
        settings.late_threshold_minutes = late_threshold
        settings.late_penalty_per_minute = penalty
    else:
        settings = BusinessSettings(
            salon_name="Test Salon",
            working_hours=days,
            late_threshold_minutes=late_threshold,
            late_penalty_per_minute=penalty,
        )
        db_session.add(settings)
    db_session.commit()
    return settings


def test_duplicate_checkin_rejected(client, db_session):
    make_user(db_session, role="cashier")
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    first = client.post(
        "/api/v1/barber-presence/register",
        params={"employee_id": barber.id, "status_type": "in"},
        headers=headers,
    )
    assert first.status_code == 200, first.text

    second = client.post(
        "/api/v1/barber-presence/register",
        params={"employee_id": barber.id, "status_type": "in"},
        headers=headers,
    )
    assert second.status_code == 400, second.text


def test_late_checkin_creates_penalty_with_configured_rate(client, db_session):
    make_user(db_session, role="cashier")
    _seed_settings(db_session, late_threshold=15, penalty=0.75)
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    # 12:00 is unambiguously after a 09:00 opening + 15-minute threshold and
    # stays "today" for the state machine.
    now = salon_now()
    late_ts = now.replace(hour=12, minute=0, second=0, microsecond=0) if now.hour >= 12 \
        else now - timedelta(minutes=30)

    resp = client.post(
        "/api/v1/barber-presence/register",
        params={
            "employee_id": barber.id,
            "status_type": "in",
            "timestamp": late_ts.isoformat(),
            "late_reason": "ازدحام المرور",
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["is_late"] is True

    penalties = db_session.query(AttendancePenalty).filter(AttendancePenalty.employee_id == barber.id).all()
    assert len(penalties) == 1
    # Amount must use the configured 0.75, not a hardcoded or stale 0.5/2.0.
    assert float(penalties[0].penalty_amount) == pytest.approx(penalties[0].late_minutes * 0.75)


def test_late_checkin_without_reason_rejected(client, db_session):
    make_user(db_session, role="cashier")
    _seed_settings(db_session, late_threshold=0)
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    resp = client.post(
        "/api/v1/barber-presence/register",
        params={"employee_id": barber.id, "status_type": "in"},
        headers=headers,
    )
    assert resp.status_code == 400, resp.text
    assert "سبب التأخير" in resp.text


def test_xlsx_import_no_500_and_reimport_is_idempotent(client, db_session):
    make_user(db_session, role="cashier")
    _seed_settings(db_session)
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    import pandas as pd

    sheet = pd.DataFrame(
        [{"employee_id": barber.id, "date": "2026-11-01", "time": "08:50:00", "status": "in"}]
    )
    buffer = io.BytesIO()
    sheet.to_excel(buffer, index=False)
    xlsx_bytes = buffer.getvalue()

    first = client.post(
        "/api/v1/barber-presence/import-excel",
        files={"file": ("bio.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    imported = first.json()["imported"]
    assert imported == 1
    assert db_session.query(EmployeePresenceLog).count() == 1

    # The same file uploaded again must not duplicate anything.
    second = client.post(
        "/api/v1/barber-presence/import-excel",
        files={"file": ("bio.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    assert second.status_code == 200, second.text
    assert second.json()["imported"] == 0
    assert db_session.query(EmployeePresenceLog).count() == 1


def test_history_endpoint_returns_window_logs(client, db_session):
    make_user(db_session, role="cashier")
    _seed_settings(db_session)
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    old = EmployeePresenceLog(
        employee_id=barber.id,
        status="in",
        created_at=datetime(2026, 10, 5, 9, 0, 0),
        source="manual",
    )
    recent = EmployeePresenceLog(
        employee_id=barber.id,
        status="out",
        created_at=datetime(2026, 11, 10, 21, 0, 0),
        source="manual",
    )
    db_session.add_all([old, recent])
    db_session.commit()

    resp = client.get(
        "/api/v1/barber-presence/history",
        params={"start_date": "2026-11-01", "end_date": "2026-11-30"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["status"] == "out"
    assert rows[0]["employee_name"]


def test_penalties_endpoint_lists_late_penalties_with_employee(client, db_session):
    make_user(db_session, role="owner")
    _seed_settings(db_session, late_threshold=15, penalty=0.75)
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    now = salon_now()
    late_ts = now.replace(hour=12, minute=0, second=0, microsecond=0) if now.hour >= 12 \
        else now - timedelta(minutes=30)
    client.post(
        "/api/v1/barber-presence/register",
        params={
            "employee_id": barber.id,
            "status_type": "in",
            "timestamp": late_ts.isoformat(),
            "late_reason": "ازدحام",
        },
        headers=headers,
    )

    resp = client.get("/api/v1/barber-presence/penalties", headers=headers)
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["employee_id"] == barber.id
    assert rows[0]["employee_name"] == barber.full_name
    assert rows[0]["penalty_amount"] == pytest.approx(rows[0]["late_minutes"] * 0.75)
    assert rows[0]["is_excused"] is False


def test_penalty_excuse_toggle_owner_allowed_cashier_forbidden(client, db_session):
    make_user(db_session, username="owner-penalties", role="owner")
    settings = _seed_settings(db_session, late_threshold=15, penalty=0.5)
    settings.penalty_cancel_pin_hash = get_password_hash("1234")
    db_session.commit()
    barber = _seed_barber(db_session)
    headers = auth_headers(client, username="owner-penalties", password="Cashier123")

    penalty = AttendancePenalty(
        employee_id=barber.id,
        date=salon_now().date(),
        late_minutes=30,
        penalty_amount=15,
    )
    db_session.add(penalty)
    db_session.commit()
    db_session.refresh(penalty)

    # Cashier (front desk) must not waive a financial penalty.
    make_user(db_session, username="cashier1", role="cashier")
    cashier_headers = auth_headers(client, username="cashier1", password="Cashier123")
    denied = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"is_excused": True, "pin": "1234"},
        headers=cashier_headers,
    )
    assert denied.status_code == 403

    # Un-waiving never existed and must not silently come back.
    unexcused = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"is_excused": False},
        headers=headers,
    )
    assert unexcused.status_code == 409

    # Wrong PIN rejected — and the penalty stays applied.
    wrong_pin = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"is_excused": True, "pin": "0000"},
        headers=headers,
    )
    assert wrong_pin.status_code == 403
    db_session.refresh(penalty)
    assert penalty.is_excused is False

    # Correct PIN waives exactly once — irreversible by design.
    excused = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"is_excused": True, "pin": "1234"},
        headers=headers,
    )
    assert excused.status_code == 200, excused.text
    assert excused.json()["is_excused"] is True

    again = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"is_excused": True, "pin": "1234"},
        headers=headers,
    )
    assert again.status_code == 409


def test_waiver_without_configured_pin_is_refused(client, db_session):
    make_user(db_session, username="owner-no-pin", role="owner")
    _seed_settings(db_session)
    barber = _seed_barber(db_session)
    headers = auth_headers(client, username="owner-no-pin", password="Cashier123")

    penalty = AttendancePenalty(
        employee_id=barber.id, date=salon_now().date(),
        late_minutes=10, penalty_amount=5,
    )
    db_session.add(penalty)
    db_session.commit()
    db_session.refresh(penalty)

    resp = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"is_excused": True, "pin": "1234"},
        headers=headers,
    )
    assert resp.status_code == 409
    assert "رقم الإلغاء" in resp.text


def test_closed_month_freezes_penalty_writes(client, db_session):
    make_user(db_session, username="owner-locked", role="owner")
    settings = _seed_settings(db_session, late_threshold=15, penalty=0.5)
    settings.penalty_cancel_pin_hash = get_password_hash("1234")
    barber = _seed_barber(db_session)
    headers = auth_headers(client, username="owner-locked", password="Cashier123")

    today = salon_now().date()
    penalty = AttendancePenalty(
        employee_id=barber.id, date=today, late_minutes=10, penalty_amount=5,
    )
    db_session.add(penalty)
    db_session.commit()
    db_session.refresh(penalty)

    # Close the current month in the archive.
    now = salon_now()
    closure = MonthClosure(
        year=now.year,
        month=now.month,
        closed_at=datetime.now(),
        closed_by_user_id=None,
        invoice_count=0,
        total_amount=0,
    )
    db_session.add(closure)
    db_session.commit()

    manual = client.post(
        "/api/v1/barber-presence/penalties",
        json={
            "employee_id": barber.id,
            "penalty_amount": 5,
            "reason": "سبب",
            "date": today.isoformat(),
        },
        headers=headers,
    )
    assert manual.status_code == 409

    waived = client.patch(
        f"/api/v1/barber-presence/penalties/{penalty.id}",
        json={"is_excused": True, "pin": "1234"},
        headers=headers,
    )
    assert waived.status_code == 409

    # Lateness still recorded, but no penalty row appears for a locked month.
    now_dt = salon_now()
    late_ts = (
        now_dt.replace(hour=12, minute=0, second=0, microsecond=0)
        if now_dt.hour >= 12
        else now_dt - timedelta(minutes=30)
    )
    before = db_session.query(AttendancePenalty).count()
    make_user(db_session, username="cashier-punch", role="cashier")
    punch_headers = auth_headers(client, username="cashier-punch", password="Cashier123")
    punch = client.post(
        "/api/v1/barber-presence/register",
        params={
            "employee_id": barber.id,
            "status_type": "in",
            "timestamp": late_ts.isoformat(),
            "late_reason": "ازدحام",
        },
        headers=punch_headers,
    )
    assert punch.status_code == 200, punch.text
    assert db_session.query(AttendancePenalty).count() == before


def test_manual_penalty_with_minutes_derives_amount_from_settings(client, db_session):
    make_user(db_session, username="owner-manual-penalty", role="owner")
    _seed_settings(db_session, late_threshold=15, penalty=0.5)
    barber = _seed_barber(db_session)
    headers = auth_headers(client, username="owner-manual-penalty", password="Cashier123")

    resp = client.post(
        "/api/v1/barber-presence/penalties",
        json={"employee_id": barber.id, "late_minutes": 40, "reason": "كسر قاعدة اللباس"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["penalty_amount"] == pytest.approx(20.0)  # 40 x 0.5
    assert body["source"] == "manual"
    stored = db_session.query(AttendancePenalty).filter(AttendancePenalty.id == body["id"]).first()
    assert stored.reason == "كسر قاعدة اللباس"


def test_manual_penalty_requires_reason_and_known_employee(client, db_session):
    make_user(db_session, username="owner-validation", role="owner")
    barber = _seed_barber(db_session)
    headers = auth_headers(client, username="owner-validation", password="Cashier123")

    no_reason = client.post(
        "/api/v1/barber-presence/penalties",
        json={"employee_id": barber.id, "penalty_amount": 50},
        headers=headers,
    )
    assert no_reason.status_code == 400

    unknown = client.post(
        "/api/v1/barber-presence/penalties",
        json={"employee_id": 999999, "penalty_amount": 50, "reason": "اختبار"},
        headers=headers,
    )
    assert unknown.status_code == 404

    neither = client.post(
        "/api/v1/barber-presence/penalties",
        json={"employee_id": barber.id, "reason": "سبب بدون قيمة"},
        headers=headers,
    )
    assert neither.status_code == 422


def test_manual_penalty_explicit_amount_wins_over_minutes(client, db_session):
    make_user(db_session, username="owner-explicit", role="owner")
    barber = _seed_barber(db_session)
    headers = auth_headers(client, username="owner-explicit", password="Cashier123")

    resp = client.post(
        "/api/v1/barber-presence/penalties",
        json={"employee_id": barber.id, "late_minutes": 100, "penalty_amount": 75, "reason": "مغادرة مبكرة"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["penalty_amount"] == pytest.approx(75.0)


def test_auto_penalty_switch_off_records_late_without_penalty(client, db_session):
    make_user(db_session, role="cashier")
    settings = _seed_settings(db_session, late_threshold=15, penalty=0.5)
    settings.auto_penalty_enabled = False
    db_session.commit()
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    now = salon_now()
    late_ts = now.replace(hour=12, minute=0, second=0, microsecond=0) if now.hour >= 12 \
        else now - timedelta(minutes=30)
    resp = client.post(
        "/api/v1/barber-presence/register",
        params={
            "employee_id": barber.id,
            "status_type": "in",
            "timestamp": late_ts.isoformat(),
            "late_reason": "ازدحام",
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_late"] is True
    # Late flag recorded, but the salon opted out of automatic deduction.
    assert db_session.query(AttendancePenalty).count() == 0
    log = db_session.query(EmployeePresenceLog).first()
    assert log.is_late is True and log.late_minutes > 0


def test_penalties_list_reports_source(client, db_session):
    make_user(db_session, username="owner-source", role="owner")
    _seed_settings(db_session, late_threshold=15, penalty=0.5)
    barber = _seed_barber(db_session)
    headers = auth_headers(client, username="owner-source", password="Cashier123")

    client.post(
        "/api/v1/barber-presence/penalties",
        json={"employee_id": barber.id, "penalty_amount": 30, "reason": "غياب بدون إذن"},
        headers=headers,
    )

    resp = client.get("/api/v1/barber-presence/penalties", headers=headers)
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert rows and rows[0]["source"] == "manual"


def test_expected_net_deducts_active_penalties_only(client, db_session):
    make_user(db_session, username="owner-payroll", role="owner")
    _seed_settings(db_session)
    barber = _seed_barber(db_session)
    barber.base_salary = 3000
    db_session.commit()
    headers = auth_headers(client, username="owner-payroll", password="Cashier123")

    today = salon_now().date()
    active = AttendancePenalty(
        employee_id=barber.id, date=today, late_minutes=60,
        reason="ازدحام", penalty_amount=25, is_excused=False, source="auto",
    )
    waived = AttendancePenalty(
        employee_id=barber.id, date=today, late_minutes=120,
        reason="عذر", penalty_amount=999, is_excused=True, source="manual",
    )
    db_session.add_all([active, waived])
    db_session.commit()

    resp = client.get(
        "/api/v1/payroll/expected-net",
        params={"employee_id": barber.id},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Waived penalty must never touch the salary; active penalties must.
    assert float(body["late_penalties"]) == pytest.approx(25.0)
    assert float(body["auto_deduction"]) >= 25.0
    assert float(body["net_salary"]) <= 3000 - 25


def test_fingerprint_device_uses_same_state_machine(client, db_session):
    # Fingerprint records through require_owner_or_manager (the device acts as
    # a trusted writer) and the shared apply_punch engine.
    make_user(db_session, role="owner")
    _seed_settings(db_session)
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    first = client.post(
        "/api/v1/attendance/fingerprint",
        params={"employee_id": barber.id, "type": "in"},
        headers=headers,
    )
    assert first.status_code == 200, first.text

    dup = client.post(
        "/api/v1/attendance/fingerprint",
        params={"employee_id": barber.id, "type": "in"},
        headers=headers,
    )
    assert dup.status_code == 400, dup.text
