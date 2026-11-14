"""Single source of truth for attendance state, policy and punches.

Three pieces used to live inside `barber_presence.py` while two legacy
endpoints in `attendance.py` re-implemented fragments of them, and the copies
had drifted: a "fingerprint" punch could record a duplicate check-in, skip the
late-reason policy and bypass penalty accounting entirely. Everything the
screen reasons about — an employee's current status, the lateness policy, and
recording one punch — is now defined here and nowhere else.
"""

from __future__ import annotations

from datetime import datetime, time
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.clock import salon_now
from app.core.working_hours import day_key, normalize_working_hours
from app.models.business_settings import BusinessSettings
from app.models.employee import Employee
from app.models.employee_presence_log import EmployeePresenceLog, AttendancePenalty
from app.models.month_closure import MonthClosure

# Fallbacks used only when BusinessSettings has no row yet. The live values
# come from the database so the settings dialog and this engine cannot drift.
LATE_THRESHOLD_MINUTES = 15
PENALTY_PER_LATE_MINUTE = 0.5  # Currency per minute late

VALID_STATUSES = ("in", "out", "break", "break_end")

# Two punches of the same type within this window are treated as one. The
# fingerprint device can double-fire on a wet or slow read; without this guard
# the log fills with duplicate-second rows (the live database already contains
# a break_end + out pair stamped 21:09:00 twice).
DUPLICATE_WINDOW_SECONDS = 120


def month_is_locked(db: Session, day) -> bool:
    """True when the archive month-closure covers `day`.

    A closed month freezes everything that creates money obligations: no
    manual penalty, no waiver, no auto penalty from a late punch. The
    lateness itself is still recorded (is_late/late_minutes) so reports
    stay complete; only the deduction is suppressed.

    Behaviour change (today's delivery): a month is automatically archived
    once the calendar rolls past it — closed not only when an operator taps
    "close month" in the archive screen, but also as soon as the month in
    question is no longer the current month. This is the invariant a seeded
    salon needs:

    * September and earlier are read-only once October starts.
    * October's penalties can still be edited while October is open, but the
      moment November arrives, October's penalties are frozen — payroll for
      October already ran (it ran at month end), so nothing legitimate would
      change after the fact.

    Explicit closures (month_closures table) are additive on top of this
    rule: a manually closed month stays closed even while it is still the
    current month.
    """
    today = salon_now().date()
    if (day.year, day.month) < (today.year, today.month):
        return True
    return (
        db.query(MonthClosure)
        .filter(MonthClosure.year == day.year, MonthClosure.month == day.month)
        .first()
        is not None
    )


def attendance_policy(db: Session) -> dict:
    """Late threshold, penalty rate and auto-penalty switch, from settings."""
    settings = db.query(BusinessSettings).first()
    if not settings:
        return {
            "late_threshold_minutes": LATE_THRESHOLD_MINUTES,
            "late_penalty_per_minute": PENALTY_PER_LATE_MINUTE,
            "auto_penalty_enabled": True,
        }
    return {
        "late_threshold_minutes": int(settings.late_threshold_minutes or LATE_THRESHOLD_MINUTES),
        "late_penalty_per_minute": float(settings.late_penalty_per_minute or PENALTY_PER_LATE_MINUTE),
        "auto_penalty_enabled": bool(settings.auto_penalty_enabled) if settings.auto_penalty_enabled is not None else True,
    }


def is_late_for_shift(db: Session, dt: datetime) -> tuple:
    """Check if a check-in is late. Returns (is_late, expected_time_str, late_minutes)."""
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return False, None, 0

    threshold = int(settings.late_threshold_minutes or LATE_THRESHOLD_MINUTES)
    hours = normalize_working_hours(settings.working_hours)
    day_config = hours.get(day_key(dt), {})

    if not day_config.get("is_open") or not day_config.get("open_time"):
        return False, None, 0

    try:
        start_str = day_config["open_time"]
        start_time = datetime.strptime(start_str, "%H:%M").time()
        current_time = dt.time()
        start_minutes = start_time.hour * 60 + start_time.minute
        current_minutes = current_time.hour * 60 + current_time.minute
        diff = current_minutes - start_minutes

        if diff > threshold:
            return True, start_str, diff
        return False, start_str, 0
    except Exception:
        return False, None, 0


def _log_entry(log: EmployeePresenceLog) -> dict:
    """Serialise one log row the way the API returns it."""
    log_time = log.created_at
    return {
        "id": log.id,
        "status": log.status,
        "is_late": log.is_late,
        "late_minutes": log.late_minutes,
        "late_reason": log.late_reason,
        "source": log.source,
        "created_at": log_time.isoformat() if log_time else None,
    }


def get_employee_status(db: Session, employee_id: int) -> dict:
    """Get current employee status based on today's logs."""
    today = salon_now().date()
    logs = (
        db.query(EmployeePresenceLog)
        .filter(EmployeePresenceLog.employee_id == employee_id)
        .filter(func.date(EmployeePresenceLog.created_at) == today)
        .order_by(EmployeePresenceLog.created_at.asc())
        .all()
    )

    status = "out"
    last_log = None
    total_minutes = 0
    current_session_start = None
    logs_data = []

    for log in logs:
        log_time = log.created_at
        logs_data.append(_log_entry(log))

        if log.status == "in":
            status = "in"
            current_session_start = log_time
        elif log.status == "break":
            status = "break"
            if current_session_start:
                total_minutes += (log_time - current_session_start).total_seconds() / 60
                current_session_start = None
        elif log.status == "break_end":
            status = "in"
            current_session_start = log_time
        elif log.status == "out":
            status = "out"
            if current_session_start:
                total_minutes += (log_time - current_session_start).total_seconds() / 60
                current_session_start = None

        last_log = log

    return {
        "current_status": status,
        "last_log": _log_entry(last_log) if last_log else None,
        "total_worked_minutes": round(total_minutes),
        "total_worked_hours": round(total_minutes / 60, 1),
        "logs_today": logs_data,
        "is_late": last_log.is_late if last_log and last_log.status == "in" else False,
        "late_reason": last_log.late_reason if last_log and last_log.is_late else None,
    }


def apply_punch(
    db: Session,
    *,
    employee_id: int,
    status_type: str,
    dt: Optional[datetime] = None,
    late_reason: Optional[str] = None,
    source: str = "manual",
    require_late_reason: bool = True,
) -> dict:
    """Validate and persist one attendance punch. Raises HTTPException on error.

    Every write path (manual register, fingerprint device, biometric import)
    must go through this so the state machine, the late policy and the penalty
    accounting cannot drift apart again.

    `require_late_reason=False` is for unattended writers (the fingerprint
    device): they cannot supply a reason, and refusing to record the punch
    would lose the attendance event entirely — the number one thing this table
    must never do. The punch is still marked late and still writes a penalty.
    """
    if status_type not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="نوع العملية غير صحيح")

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    if dt is None:
        dt = salon_now()

    # State machine — mirrors today's logs only, exactly as the screen reasons
    # about the employee's status.
    emp_status = get_employee_status(db, employee_id)
    current = emp_status["current_status"]

    if status_type == "in" and current == "in":
        raise HTTPException(
            status_code=400,
            detail="الموظف مسجل حضوره بالفعل. يرجى تسجيل انصراف أولاً.",
        )
    if status_type == "out" and current == "out":
        raise HTTPException(
            status_code=400,
            detail="الموظف مسجل انصرافه بالفعل. يرجى تسجيل حضور أولاً.",
        )
    if status_type == "break" and current != "in":
        raise HTTPException(status_code=400, detail="يجب تسجيل الحضور أولاً.")
    if status_type == "break_end" and current != "break":
        raise HTTPException(status_code=400, detail="الموظف ليس في استراحة.")

    # Late policy. A human-registered late check-in requires a reason; an
    # unattended device cannot provide one, so it records the punch marked
    # late instead of dropping the event.
    is_late, expected_time, late_minutes = is_late_for_shift(db, dt)
    is_late = is_late and status_type == "in"

    if (
        is_late
        and require_late_reason
        and (not late_reason or not str(late_reason).strip())
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"تسجيل متأخر {late_minutes} دقيقة عن الموعد ({expected_time}). "
                "يرجى كتابة سبب التأخير."
            ),
        )

    # Duplicate-punch guard: a same-type punch within the window of an existing
    # log is a bounce, not a real transition. Compared against the punch's own
    # timestamp so back-dated corrections beyond the window stay possible.
    for existing in emp_status.get("logs_today", []) or []:
        if existing.get("status") != status_type:
            continue
        stamp = existing.get("created_at")
        if not stamp:
            continue
        try:
            delta = abs((dt - datetime.fromisoformat(str(stamp))).total_seconds())
        except ValueError:
            continue
        if delta <= DUPLICATE_WINDOW_SECONDS:
            raise HTTPException(
                status_code=400,
                detail="نفس العملية مسجلة قبل ثوانٍ. لن يتم تكرار التسجيل.",
            )

    policy = attendance_policy(db)
    penalty_rate = policy["late_penalty_per_minute"]

    log = EmployeePresenceLog(
        employee_id=employee_id,
        status=status_type,
        created_at=dt,
        is_late=is_late,
        late_minutes=late_minutes if is_late else 0,
        late_reason=str(late_reason).strip() if is_late and late_reason else None,
        source=source,
    )
    db.add(log)

    # The engine honours a salon-wide switch to track lateness without
    # deducting. is_late/late_minutes are recorded either way. A closed
    # archive month suppresses the deduction entirely — penalties written
    # after month close would silently move money inside a frozen period.
    if is_late and late_minutes > 0 and policy["auto_penalty_enabled"]:
        if month_is_locked(db, dt.date()):
            pass  # Locked month: lateness recorded, no penalty row created.
        else:
            db.add(
                AttendancePenalty(
                    employee_id=employee_id,
                    date=dt.date(),
                    late_minutes=late_minutes,
                    reason=str(late_reason).strip() if late_reason else None,
                    penalty_amount=late_minutes * penalty_rate,
                    source="auto",
                )
            )

    db.commit()

    return {
        "message": "تم التسجيل بنجاح",
        "is_late": is_late,
        "late_minutes": late_minutes if is_late else 0,
        "employee_name": employee.full_name,
    }
