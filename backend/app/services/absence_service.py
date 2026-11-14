"""Full-day absence detection and penalty issuance.

A workday with zero recorded punches for an active employee is a missed shift,
not a quiet day. Each such day in the target month (up to today) earns one
`AttendancePenalty` row with source='absence' — the sibling of the 'auto'
(late-arrival) penalty, so it flows through the same deduction, waiver, excuse
and report paths.

Rules
-----
* Work days default to Mon-Thu + Sat + Sun when `work_days_json` is unset —
  same default the payroll metrics use.
* Days where the salon is closed for everyone (BusinessSettings
  `working_hours[day].is_open == False`) produce no absence.
* Days before the employee's `hire_date` produce no absence.
* Idempotent: re-running for the same (employee, month) never duplicates an
  existing absence penalty.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.clock import salon_now
from app.core.working_hours import day_key, normalize_working_hours
from app.models.business_settings import BusinessSettings
from app.models.employee import Employee
from app.models.employee_presence_log import EmployeePresenceLog, AttendancePenalty
from app.services.activity_log_service import log_activity

ABSENCE_SOURCE = "absence"
ABSENCE_REASON = "غياب بدون إذن"
DAY_RATE_QUANTUM = Decimal("0.01")


def _employee_work_days(emp: Employee) -> list[int]:
    raw = emp.work_days_json
    if isinstance(raw, list) and raw:
        try:
            return sorted({int(d) for d in raw if str(d).isdigit() and 0 <= int(d) <= 6})
        except (TypeError, ValueError):
            pass
    # Monday=0 ... Sunday=6; defaults to working all days except Friday(4).
    return [0, 1, 2, 3, 5, 6]


def _hire_date(emp: Employee) -> Optional[date]:
    raw = emp.hire_date
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    return None


def ensure_absence_penalties(
    db: Session,
    *,
    year: int,
    month: int,
    today: Optional[date] = None,
    created_by_user_id: Optional[int] = None,
) -> dict:
    """Create absence penalties for all active employees in the month.

    Returns {"created": n, "skipped_existing": n, "skipped_holidays": n}.
    Idempotent — safe to re-run at any point (payroll calculate, manual
    backfill from the UI).
    """
    today = today or salon_now().date()
    last_day = min(date(year, month, monthrange(year, month)[1]), today)

    settings = db.query(BusinessSettings).first()
    raw_hours = settings.working_hours if settings else None
    # If the salon never configured working hours, every day is treated as a
    # working day with open hours — absence detection must still work. The
    # normalize helper degrades unknown/bad days to closed, so only apply it
    # when a real payload exists.
    hours_map = normalize_working_hours(raw_hours) if raw_hours else {}
    closed_days = {day for day, cfg in hours_map.items() if cfg.get("is_open") is False}

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    created = 0
    skipped_existing = 0
    skipped_holidays = 0

    for emp in employees:
        base = Decimal(str(emp.base_salary or 0))
        if base <= 0:
            continue
        work_days = _employee_work_days(emp)
        hire = _hire_date(emp)

        d = date(year, month, 1)
        while d <= last_day:
            if d.weekday() in work_days:
                day_key_d = day_key(d)
                if day_key_d in closed_days:
                    skipped_holidays += 1
                    d += timedelta(days=1)
                    continue
                if hire is None or d >= hire:
                    exists = (
                        db.query(AttendancePenalty.id)
                        .filter(
                            AttendancePenalty.employee_id == emp.id,
                            AttendancePenalty.date == d,
                            AttendancePenalty.source == ABSENCE_SOURCE,
                        )
                        .first()
                    )
                    if exists:
                        skipped_existing += 1
                    else:
                        has_log = (
                            db.query(EmployeePresenceLog.id)
                            .filter(
                                EmployeePresenceLog.employee_id == emp.id,
                                func.date(EmployeePresenceLog.created_at) == d,
                            )
                            .first()
                        )
                        if not has_log:
                            day_rate = (base / Decimal("30")).quantize(DAY_RATE_QUANTUM, rounding=ROUND_HALF_UP)
                            db.add(
                                AttendancePenalty(
                                    employee_id=emp.id,
                                    date=d,
                                    late_minutes=0,
                                    reason=ABSENCE_REASON,
                                    penalty_amount=day_rate,
                                    source=ABSENCE_SOURCE,
                                )
                            )
                            created += 1
            d += timedelta(days=1)

    if created:
        # Commit once for the whole batch — partial commits leave half-created
        # absence months behind on failure.
        db.commit()
        if created_by_user_id:
            log_activity(
                db,
                user_id=created_by_user_id,
                action="ABSENCE_PENALTIES_GENERATED",
                entity_type="AttendancePenalty",
                entity_id=None,
                description=f"احتساب غياب شهر {year:04d}-{month:02d}: {created} جزاء",
            )

    return {"created": created, "skipped_existing": skipped_existing, "skipped_holidays": skipped_holidays}
