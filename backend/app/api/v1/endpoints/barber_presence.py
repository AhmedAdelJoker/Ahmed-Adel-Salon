from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from datetime import datetime, timedelta, date, time as dt_time
from typing import Optional
import io

import pandas as pd

from app.db.session import get_db
from app.api.deps import (
    require_any_staff,
    require_cashier_manager_owner,
    require_owner_or_manager,
    require_working_hours_editor,
)
from app.models.user import User
from app.models.employee import Employee
from app.models.employee_presence_log import EmployeePresenceLog, AttendancePenalty
from app.models.leave_request import LeaveRequest
from app.models.business_settings import BusinessSettings
from app.core.upload_security import validate_data_sheet
from app.core.config import settings as app_settings
from app.core.rate_limit import rate_limit
from app.services.activity_log_service import log_activity
from app.core.clock import salon_now
from app.core.security import get_password_hash, verify_password
from app.models.month_closure import MonthClosure
from app.services.attendance_service import month_is_locked
from app.core.working_hours import (
    WorkingHoursError,
    day_key,
    normalize_working_hours,
    current_window,
    validate_working_hours,
)
from app.services.websocket import manager
from app.services.attendance_service import (
    attendance_policy as _attendance_policy,
    get_employee_status as _get_employee_status,
    is_late_for_shift as _is_late_for_shift,
    apply_punch,
)

router = APIRouter(prefix="/barber-presence", tags=["Attendance"])


def _working_hours_diff(before: dict, after: dict) -> str:
    """Human-readable per-day diff, so the audit log says what actually changed."""
    from app.core.working_hours import DAYS_AR

    parts: list[str] = []
    for day, label in DAYS_AR.items():
        left = before.get(day) or {}
        right = after.get(day) or {}
        if left == right:
            continue
        if left.get("is_open") and not right.get("is_open"):
            parts.append(f"{label}: مغلق")
        elif not left.get("is_open") and right.get("is_open"):
            parts.append(f"{label}: مفتوح {right.get('open_time')}–{right.get('close_time')}")
        else:
            parts.append(
                f"{label}: {left.get('open_time')}–{left.get('close_time')} ← "
                f"{right.get('open_time')}–{right.get('close_time')}"
            )
    return "تعديل ساعات العمل: " + ("، ".join(parts) if parts else "بدون تغيير فعلي")

# Fallback constants kept for reference/analytics defaults — the live policy
# values come from BusinessSettings via app.services.attendance_service.

# Staff allowed to view/manage leave requests on behalf of any employee.
# Cashier (front desk) is included because the router exposes /attendance
# (which hosts the Leaves UI) to CASHIER; barbers are scoped to themselves
# only, and approve/reject stays restricted to require_owner_or_manager.
LEAVE_MANAGE_ROLES = {"admin", "owner", "manager", "accountant", "cashier"}


def _employee_id_for_user(current_user: User) -> Optional[int]:
    return current_user.barber_id or current_user.employee_id


def _require_employee_scope(current_user: User, employee_id: int) -> None:
    if current_user.role in LEAVE_MANAGE_ROLES:
        return
    if current_user.role == "barber" and _employee_id_for_user(current_user) == employee_id:
        return
    raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذا الموظف")


@router.get("/current")
def get_current_presence(db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    """Get all employees with their current status today."""
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    result = []
    
    for emp in employees:
        emp_status = _get_employee_status(db, emp.id)
        result.append({
            "employee_id": emp.id,
            "employee_name": emp.full_name,
            "current_status": emp_status["current_status"],
            "last_log": emp_status["last_log"],
            "total_worked_hours": emp_status["total_worked_hours"],
            "total_worked_minutes": emp_status["total_worked_minutes"],
            "is_late": emp_status["is_late"],
            "late_reason": emp_status["late_reason"],
        })
    
    return result


@router.get("/employee/{employee_id}")
def get_employee_details(employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    """Get detailed status for a specific employee."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    status = _get_employee_status(db, employee_id)
    
    # Calculate remaining shift time
    remaining_shift = None
    settings = db.query(BusinessSettings).first()
    if settings and settings.working_hours:
        now = salon_now()
        hours = normalize_working_hours(settings.working_hours)
        window = current_window(hours, now)
        if window:
            closes_at = window[2]
            diff = int((closes_at - now).total_seconds() / 60)
            if diff > 0:
                h, m = divmod(diff, 60)
                remaining_shift = f"{h}س {m}د"
            else:
                remaining_shift = "انتهت"
    
    return {
        "employee": {
            "id": emp.id,
            "full_name": emp.full_name,
            "job_title": emp.job_title,
            "phone": emp.phone_primary,
        },
        "remaining_shift_time": remaining_shift,
        **status,
    }


@router.post("/register")
async def manual_register(
    employee_id: int = Query(...),
    status_type: str = Query(...),
    timestamp: str | None = Query(None),
    late_reason: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """تسجيل يدوي - المدير/المالك/الكاشير.

    The full state machine, late policy and penalty accounting live in
    `app.services.attendance_service.apply_punch` — shared with the fingerprint
    endpoint so both paths cannot drift.
    """
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp)
        except ValueError:
            raise HTTPException(status_code=400, detail="تنسيق الوقت غير صحيح")
    else:
        dt = salon_now()

    result = apply_punch(
        db,
        employee_id=employee_id,
        status_type=status_type,
        dt=dt,
        late_reason=late_reason,
        source="manual",
    )

    # Broadcast attendance update via WebSocket
    try:
        updated_status = _get_employee_status(db, employee_id)
        await manager.broadcast({
            "event": "attendance_update",
            "employee_id": employee_id,
            "current_status": updated_status["current_status"],
            "total_worked_hours": updated_status["total_worked_hours"],
            "total_worked_minutes": updated_status["total_worked_minutes"],
            "is_late": updated_status["is_late"],
            "late_reason": updated_status["late_reason"],
            "last_log": updated_status["last_log"],
        })
    except Exception:
        pass  # Don't fail the request if WebSocket fails

    return result


def _read_sheet_rows(content: bytes, filename: str) -> list[dict]:
    """Parse an uploaded CSV or Excel sheet into plain dicts.

    Both import endpoints used to `content.decode("utf-8")` and parse with
    `csv.DictReader`. An .xlsx file is a ZIP binary — decoding it as text
    raises UnicodeDecodeError *outside* the try block, so every Excel upload
    returned 500 (the UI's file picker advertised .xlsx/.xls). Pandas handles
    both formats and the old legacy endpoint already used it for exactly this.
    """
    lower = (filename or "").lower()
    df = pd.read_excel(io.BytesIO(content)) if lower.endswith((".xlsx", ".xls")) else pd.read_csv(
        io.BytesIO(content), dtype=str
    )
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df.where(pd.notna(df), None).to_dict("records")


_SHEET_COLUMN_ALIASES = {
    "الاسم": "name",
    "اسم الموظف": "name",
    "employee_name": "name",
    "emp_name": "name",
    "الحالة": "status",
    "STATUS": "status",
    "التاريخ": "date",
    "DATE": "date",
    "الوقت": "time",
    "TIME": "time",
    "الرقم": "employee_id",
    "emp_id": "employee_id",
    "رقم الموظف": "employee_id",
    "timestamp": "datetime",
    "created_at": "datetime",
}

_STATUS_ALIASES = {
    "in": "in", "حضور": "in", "دخول": "in", "check-in": "in", "checkin": "in",
    "out": "out", "انصراف": "out", "خروج": "out", "check-out": "out", "checkout": "out",
    "break": "break", "استراحة": "break",
    "break_end": "break_end", "نهاية الاستراحة": "break_end",
}

_DATE_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%d-%m-%Y %H:%M", "%d/%m/%Y %H:%M")


def _parse_punch_time(row: dict) -> datetime:
    """Resolve the punch timestamp from a sheet row. Falls back to salon now."""
    # A single combined column wins over separate date/time columns.
    combined = row.get("datetime")
    if combined:
        parsed = pd.to_datetime(str(combined), errors="coerce", dayfirst=True)
        if pd.notna(parsed):
            return parsed.to_pydatetime().replace(tzinfo=None)
    date_str, time_str = row.get("date"), row.get("time")
    if date_str:
        for fmt in _DATE_FORMATS:
            try:
                return datetime.strptime(f"{date_str} {time_str or ''}".strip(), fmt)
            except ValueError:
                continue
        parsed = pd.to_datetime(str(date_str), errors="coerce", dayfirst=True)
        if pd.notna(parsed):
            return parsed.to_pydatetime().replace(tzinfo=None)
    # Salon wall clock, not the server default (UTC) — a UTC row written at
    # 00:30 Cairo landed on the previous day in every "today" filter.
    return salon_now()


def _normalize_sheet_status(raw: object) -> str:
    text = str(raw or "in").strip().lower()
    if text in _STATUS_ALIASES:
        return _STATUS_ALIASES[text]
    if "حض" in text or "in" in text:
        return "in"
    if "انص" in text or "خروج" in text or "out" in text:
        return "out"
    if "استراحة" in text:
        return "break"
    return "in"


def _bulk_import_rows(
    db: Session,
    rows: list[dict],
    *,
    source: str,
) -> tuple[int, list[str]]:
    """Import parsed sheet rows with employee-name/id resolution and dedup.

    Re-uploading the same file used to duplicate every row: nothing compared
    the incoming punches against what was already stored. Existing logs for the
    touched days are loaded once and matched on (employee, status, timestamp),
    so a repeat upload is an idempotent no-op.
    """
    employees = db.query(Employee).all()
    emp_by_name = {emp.full_name.strip().lower(): emp.id for emp in employees}
    emp_by_id = {str(emp.id): emp.id for emp in employees}

    punches: list[tuple[int, str, datetime]] = []
    errors: list[str] = []

    for index, row in enumerate(rows, start=2):
        raw_id = row.get("employee_id")
        name = str(row.get("name") or "").strip().lower()
        emp_id = None
        if raw_id not in (None, ""):
            emp_id = emp_by_id.get(str(raw_id).strip())
        if emp_id is None and name:
            emp_id = emp_by_name.get(name)
        if emp_id is None:
            label = name or str(raw_id or "—")
            errors.append(f"السطر {index}: الموظف '{label}' غير موجود")
            continue

        status_type = _normalize_sheet_status(row.get("status"))
        dt = _parse_punch_time(row)
        punches.append((emp_id, status_type, dt))

    if not punches:
        return 0, errors

    # One query for the affected days instead of one per row.
    days = sorted({dt.date() for _, _, dt in punches})
    existing_keys: set[tuple[int, str, str]] = set()
    for day in days:
        day_start = datetime.combine(day, dt_time.min)
        day_end = datetime.combine(day, dt_time.max)
        for log in (
            db.query(EmployeePresenceLog)
            .filter(
                EmployeePresenceLog.created_at >= day_start,
                EmployeePresenceLog.created_at <= day_end,
            )
            .all()
        ):
            existing_keys.add((log.employee_id, log.status, str(log.created_at)))

    imported = 0
    seen_this_run: set[tuple[int, str, str]] = set()
    for emp_id, status_type, dt in punches:
        stamp = str(dt)
        key = (emp_id, status_type, stamp)
        if key in existing_keys or key in seen_this_run:
            continue
        seen_this_run.add(key)

        is_late, _, late_minutes = _is_late_for_shift(db, dt)
        is_late = is_late and status_type == "in"
        log = EmployeePresenceLog(
            employee_id=emp_id,
            status=status_type,
            created_at=dt,
            is_late=is_late,
            late_minutes=late_minutes if is_late else 0,
            source=source,
        )
        db.add(log)
        imported += 1

    if imported:
        db.commit()
    return imported, errors


@router.post("/import-biometric")
async def import_biometric(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Import attendance data from a biometric device CSV/Excel file."""
    content = await validate_data_sheet(file, max_size=20 * 1024 * 1024)
    try:
        rows = _read_sheet_rows(content, file.filename or "")
        imported, errors = _bulk_import_rows(db, rows, source="biometric")
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"فشل الاستيراد: {exc}") from exc

    try:
        await manager.broadcast({"event": "attendance_refresh", "message": "تم تحديث بيانات الحضور"})
    except Exception:
        pass

    return {
        "message": f"تم استيراد {imported} سجل",
        "imported": imported,
        "errors": errors,
    }


@router.get("/analytics")
def get_analytics(
    year_month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Get attendance analytics for a specific month.

    Phase 2 fix: replaced N+1 (one query per employee) with a single
    bulk query + Python-side grouping. With 100 employees this goes
    from 101 queries to 1.
    """
    if not year_month:
        year_month = salon_now().strftime("%Y-%m")

    year, month = map(int, year_month.split("-"))

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    employee_map = {emp.id: emp for emp in employees}

    # Single query: all logs for the month — grouped in Python below
    all_logs = (
        db.query(EmployeePresenceLog)
        .filter(extract("year", EmployeePresenceLog.created_at) == year)
        .filter(extract("month", EmployeePresenceLog.created_at) == month)
        .order_by(EmployeePresenceLog.created_at.asc())
        .all()
    )

    logs_by_emp: dict[int, list[EmployeePresenceLog]] = {}
    for log in all_logs:
        logs_by_emp.setdefault(log.employee_id, []).append(log)

    analytics = []

    for emp_id, emp in employee_map.items():
        logs = logs_by_emp.get(emp_id, [])

        # Calculate stats
        work_days = set()
        total_work_minutes = 0
        late_count = 0
        total_late_minutes = 0

        daily_logs = {}
        for log in logs:
            day_key = log.created_at.strftime("%Y-%m-%d")
            if day_key not in daily_logs:
                daily_logs[day_key] = []
                work_days.add(day_key)
            daily_logs[day_key].append(log)

        for day, day_logs in daily_logs.items():
            session_start = None
            day_minutes = 0
            for log in day_logs:
                if log.status == "in":
                    session_start = log.created_at
                    if log.is_late:
                        late_count += 1
                        total_late_minutes += log.late_minutes
                elif log.status == "out" and session_start:
                    day_minutes += (log.created_at - session_start).total_seconds() / 60
                    session_start = None
            total_work_minutes += day_minutes

        avg_daily = (total_work_minutes / len(work_days)) if work_days else 0
        penalty_rate = _attendance_policy(db)["late_penalty_per_minute"]

        analytics.append({
            "employee_id": emp.id,
            "employee_name": emp.full_name,
            "work_days": len(work_days),
            "total_work_hours": round(total_work_minutes / 60, 1),
            "total_work_minutes": round(total_work_minutes),
            "late_count": late_count,
            "total_late_minutes": total_late_minutes,
            "avg_daily_hours": round(avg_daily / 60, 1),
            "penalty_amount": total_late_minutes * penalty_rate,
        })

    return {
        "year_month": year_month,
        "employee_count": len(analytics),
        "total_work_hours": sum(a["total_work_hours"] for a in analytics),
        "total_late_count": sum(a["late_count"] for a in analytics),
        "total_penalties": sum(a["penalty_amount"] for a in analytics),
        "employees": analytics,
    }


@router.get("/working-hours")
def get_working_hours(db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    settings = db.query(BusinessSettings).first()
    policy = _attendance_policy(db)
    return {
        "working_hours": normalize_working_hours(settings.working_hours if settings else None),
        # The attendance screen needs the same policy numbers the engine uses —
        # the payroll view used to hardcode 2 EGP/minute while the backend
        # applied 0.5, so the monthly view and /analytics disagreed 4x.
        "late_threshold_minutes": policy["late_threshold_minutes"],
        "late_penalty_per_minute": policy["late_penalty_per_minute"],
        "auto_penalty_enabled": policy["auto_penalty_enabled"],
        # Hash only; the PIN itself is never returned anywhere.
        "penalty_cancel_pin_configured": bool(settings and settings.penalty_cancel_pin_hash),
    }


@router.post(
    "/working-hours",
    dependencies=[
        Depends(
            rate_limit(
                "working_hours_write",
                max_requests=app_settings.SETTINGS_WRITE_RATE_LIMIT_MAX_REQUESTS,
                window_seconds=app_settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
def update_working_hours(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_working_hours_editor),
):
    try:
        validated = validate_working_hours(payload.get("working_hours", {}))
    except WorkingHoursError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    settings = db.query(BusinessSettings).first()
    if not settings:
        settings = BusinessSettings(salon_name="SalonPro", currency="EGP")
        db.add(settings)
        db.commit()
        db.refresh(settings)

    previous = normalize_working_hours(settings.working_hours)
    settings.working_hours = validated

    # Persist the late policy the dialog sends. The dialog used to include a
    # late-threshold field that was silently dropped — the engine kept its
    # hardcoded 15 minutes whatever the user typed.
    late_threshold = payload.get("late_threshold")
    if late_threshold is not None:
        try:
            threshold_value = int(late_threshold)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="حد التأخير يجب أن يكون رقماً") from None
        if not 0 <= threshold_value <= 240:
            raise HTTPException(status_code=422, detail="حد التأخير يجب أن يكون بين 0 و 240 دقيقة")
        settings.late_threshold_minutes = threshold_value

    late_penalty = payload.get("late_penalty_per_minute")
    if late_penalty is not None:
        try:
            penalty_value = float(late_penalty)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="قيمة جزاء الدقيقة يجب أن تكون رقماً") from None
        if not 0 <= penalty_value <= 100:
            raise HTTPException(status_code=422, detail="قيمة جزاء الدقيقة يجب أن تكون بين 0 و 100")
        settings.late_penalty_per_minute = penalty_value

    auto_penalty = payload.get("auto_penalty_enabled")
    if auto_penalty is not None:
        if not isinstance(auto_penalty, bool):
            raise HTTPException(status_code=422, detail="auto_penalty_enabled يجب أن يكون true أو false")
        settings.auto_penalty_enabled = auto_penalty

    # 4-digit cancellation PIN — hash once here, never store or return the
    # plain value. Only a full 4-digit change is accepted; the old hash is
    # replaced.
    pin = payload.get("penalty_cancel_pin")
    if pin is not None:
        if not isinstance(pin, str) or len(pin) != 4 or not pin.isdigit():
            raise HTTPException(status_code=422, detail="رقم الإلغاء يجب أن يكون 4 أرقام")
        settings.penalty_cancel_pin_hash = get_password_hash(pin)

    db.commit()
    db.refresh(settings)

    log_activity(
        db,
        user_id=current_user.id,
        action="UPDATE_WORKING_HOURS",
        entity_type="BusinessSettings",
        entity_id=str(settings.id),
        description=_working_hours_diff(previous, normalize_working_hours(validated)),
    )

    return {
        "working_hours": settings.working_hours,
        "late_threshold_minutes": int(settings.late_threshold_minutes or 15),
        "late_penalty_per_minute": float(settings.late_penalty_per_minute or 0.5),
        "auto_penalty_enabled": bool(settings.auto_penalty_enabled),
        "penalty_cancel_pin_configured": bool(settings.penalty_cancel_pin_hash),
        "message": "تم حفظ الإعدادات بنجاح",
    }


# ========== History (archive / calendar / monthly analytics) ==========

@router.get("/history")
def get_attendance_history(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    employee_id: Optional[int] = Query(None),
    limit: int = Query(2000, ge=1, le=20000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Historical attendance logs for the archive, calendar and monthly views.

    The screen used to build all three of those tabs from `/current`, which
    returns only *today's* logs — the archive ignored its date filter, the
    calendar showed empty days, and the monthly analytics showed today's data
    labelled as a month. This endpoint answers with the requested window.
    """
    query = db.query(EmployeePresenceLog).options(joinedload(EmployeePresenceLog.employee))
    if start_date:
        query = query.filter(EmployeePresenceLog.created_at >= datetime.combine(start_date, dt_time.min))
    if end_date:
        query = query.filter(EmployeePresenceLog.created_at <= datetime.combine(end_date, dt_time.max))
    if employee_id:
        query = query.filter(EmployeePresenceLog.employee_id == employee_id)

    logs = query.order_by(EmployeePresenceLog.created_at.desc()).limit(limit).all()

    return [
        {
            "id": log.id,
            "employee_id": log.employee_id,
            "employee_name": log.employee.full_name if log.employee else "موظف غير معروف",
            "status": log.status,
            "is_late": bool(log.is_late),
            "late_minutes": int(log.late_minutes or 0),
            "late_reason": log.late_reason,
            "source": log.source,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


# ========== Penalties ==========

@router.get("/penalties")
def list_penalties(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    employee_id: Optional[int] = Query(None),
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """قائمة الجزاءات المسجلة — حضور/حالات تأخير.

    تُعرض و تُدار من تابة «الجزاءات» في صفحة الحضور. الـ endpoint للأدمن والمدير
    والمحاسب/المالك — مثل مسارات الحضور الحساسة الأخرى.
    """
    query = (
        db.query(AttendancePenalty)
        .options(joinedload(AttendancePenalty.employee))
    )
    if start_date:
        query = query.filter(AttendancePenalty.date >= start_date)
    if end_date:
        query = query.filter(AttendancePenalty.date <= end_date)
    if employee_id:
        query = query.filter(AttendancePenalty.employee_id == employee_id)

    rows = query.order_by(AttendancePenalty.date.desc(), AttendancePenalty.id.desc()).limit(limit).all()
    locked = {
        f"{row.year:04d}-{row.month:02d}"
        for row in db.query(MonthClosure).all()
    }
    return [
        {
            "id": row.id,
            "employee_id": row.employee_id,
            "employee_name": row.employee.full_name if row.employee else "موظف غير معروف",
            "date": str(row.date),
            "late_minutes": int(row.late_minutes or 0),
            "reason": row.reason,
            "penalty_amount": float(row.penalty_amount or 0),
            "is_excused": bool(row.is_excused),
            "source": row.source or "auto",
            "locked": f"{row.date.year:04d}-{row.date.month:02d}" in locked,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.get("/penalty-months")
def get_penalty_months(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """Gate data for the penalties tab: configured PIN + locked months.

    The frontend uses this to disable the waiver action (PIN missing) and to
    show which months are frozen by the archive month-closure.
    """
    settings = db.query(BusinessSettings).first()
    locked = [
        f"{row.year:04d}-{row.month:02d}"
        for row in db.query(MonthClosure).order_by(MonthClosure.year.desc(), MonthClosure.month.desc()).all()
    ]
    return {
        "pin_configured": bool(settings and settings.penalty_cancel_pin_hash),
        "locked_months": locked,
    }


@router.post("/penalties")
def create_manual_penalty(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """إضافة جزاء يدوي من المدير/المالك — مع سبب إلزامي.

    يُستخدم للجزاءات غير المتعلقة بالبصمة: كسر قاعدة، سلوك، غياب بدون إذن.
    المبلغ: يُؤخذ كما هو إن أُرسل، أو يُحسب minutes × سعر الإعدادات إن أُرسلت
    دقائق التأخير فقط.
    """
    employee_id = payload.get("employee_id")
    reason = str(payload.get("reason") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="الموظف مطلوب")
    if len(reason) < 2:
        raise HTTPException(status_code=400, detail="السبب مطلوب (حرفان على الأقل)")

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    late_minutes = 0
    try:
        if payload.get("late_minutes") not in (None, ""):
            late_minutes = int(payload["late_minutes"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="دقائق التأخير يجب أن تكون رقماً") from None
    if late_minutes < 0 or late_minutes > 24 * 60:
        raise HTTPException(status_code=422, detail="دقائق التأخير يجب أن تكون بين 0 و 1440")

    amount: Optional[float] = None
    try:
        if payload.get("penalty_amount") not in (None, ""):
            amount = float(payload["penalty_amount"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="قيمة الجزاء يجب أن تكون رقماً") from None

    if amount is None:
        if late_minutes > 0:
            amount = round(late_minutes * _attendance_policy(db)["late_penalty_per_minute"], 2)
        else:
            raise HTTPException(
                status_code=422,
                detail="أدخل قيمة الجزاء، أو دقائق التأخير ليُحسب المبلغ تلقائياً",
            )
    if amount <= 0 or amount > 100000:
        raise HTTPException(status_code=422, detail="قيمة الجزاء يجب أن تكون بين 0.01 و 100000")

    penalty_date = salon_now().date()
    raw_date = payload.get("date")
    if raw_date:
        try:
            penalty_date = date.fromisoformat(str(raw_date))
        except ValueError:
            raise HTTPException(status_code=422, detail="التاريخ يجب أن يكون بصيغة YYYY-MM-DD") from None

    if month_is_locked(db, penalty_date):
        raise HTTPException(
            status_code=409,
            detail=f"شهر {penalty_date.strftime('%Y-%m')} مقفول في الأرشيف — لا يمكن إضافة جزاءات عليه",
        )

    penalty = AttendancePenalty(
        employee_id=int(employee_id),
        date=penalty_date,
        late_minutes=late_minutes,
        reason=reason,
        penalty_amount=amount,
        is_excused=False,
        source="manual",
    )
    db.add(penalty)
    db.commit()
    db.refresh(penalty)

    log_activity(
        db,
        user_id=current_user.id,
        action="MANUAL_PENALTY",
        entity_type="AttendancePenalty",
        entity_id=str(penalty.id),
        description=f"جزاء يدوي {amount} ج للموظف {employee.full_name}: {reason}",
    )

    return {
        "id": penalty.id,
        "employee_id": penalty.employee_id,
        "employee_name": employee.full_name,
        "date": str(penalty.date),
        "late_minutes": int(penalty.late_minutes or 0),
        "reason": penalty.reason,
        "penalty_amount": float(penalty.penalty_amount or 0),
        "is_excused": penalty.is_excused,
        "source": penalty.source,
        "message": "تم تسجيل الجزاء",
    }


@router.patch(
    "/penalties/{penalty_id}",
    dependencies=[Depends(rate_limit("penalty_waive", max_requests=10, window_seconds=60))],
)
def set_penalty_excused(
    penalty_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """إعفاء الجزاء — عملية نهائية، تتطلب رقم إلغاء من 4 أرقام.

    بمجرد الإعفاء لا يمكن التراجع عنه (لا يوجد مسار undo)، والشهر المقفول
    في الأرشيف (month_closures) مجمّد تماماً: لا إضافة، لا إعفاء، ولا
    جزاء تلقائي جديد.
    """
    penalty = db.query(AttendancePenalty).filter(AttendancePenalty.id == penalty_id).first()
    if not penalty:
        raise HTTPException(status_code=404, detail="الجزاء غير موجود")

    is_excused = payload.get("is_excused")
    if is_excused is not True:
        # No un-waiving exists. A waiver that can be undone is not a waiver.
        raise HTTPException(status_code=409, detail="الإعفاء نهائي ولا يمكن التراجع عنه")

    if month_is_locked(db, penalty.date):
        raise HTTPException(
            status_code=409,
            detail=f"شهر {penalty.date.strftime('%Y-%m')} مقفول في الأرشيف — لا يمكن تعديل الجزاءات عليه",
        )

    if penalty.is_excused:
        raise HTTPException(status_code=409, detail="الجزاء مُعفى بالفعل")

    pin = payload.get("pin")
    if not isinstance(pin, str) or len(pin) != 4 or not pin.isdigit():
        raise HTTPException(status_code=400, detail="رقم الإلغاء يجب أن يكون 4 أرقام")

    settings = db.query(BusinessSettings).first()
    if not settings or not settings.penalty_cancel_pin_hash:
        raise HTTPException(status_code=409, detail="رقم الإلغاء غير مضبوط — اضبطه من إعدادات الحضور أولاً")

    if not verify_password(pin, settings.penalty_cancel_pin_hash):
        log_activity(
            db,
            user_id=current_user.id,
            action="PENALTY_WAIVE_FAILED",
            entity_type="AttendancePenalty",
            entity_id=str(penalty.id),
            description=f"محاولة إلغاء جزاء برقم غير صحيح (الجزاء #{penalty.id})",
        )
        raise HTTPException(status_code=403, detail="رقم الإلغاء غير صحيح")

    penalty.is_excused = True
    db.commit()
    db.refresh(penalty)

    employee = db.query(Employee).filter(Employee.id == penalty.employee_id).first()
    log_activity(
        db,
        user_id=current_user.id,
        action="EXCUSE_PENALTY",
        entity_type="AttendancePenalty",
        entity_id=str(penalty.id),
        description=(
            f"إعفاء نهائي للموظف {employee.full_name if employee else penalty.employee_id}"
            f" — جزاء #{penalty.id} بقيمة {penalty.penalty_amount} ج"
        ),
    )

    return {
        "id": penalty.id,
        "is_excused": True,
        "penalty_amount": float(penalty.penalty_amount or 0),
        "message": "تم إعفاء الجزاء نهائياً",
    }


# ========== Leave Management ==========

@router.get("/leaves")
def get_leaves(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    query = db.query(LeaveRequest).options(joinedload(LeaveRequest.employee))
    if current_user.role == "barber":
        query = query.filter(
            LeaveRequest.employee_id == _employee_id_for_user(current_user)
        )
    elif current_user.role not in LEAVE_MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لعرض الإجازات")
    if status:
        query = query.filter(LeaveRequest.status == status)
    leaves = query.order_by(LeaveRequest.created_at.desc()).all()
    return [
        {
            "id": leave.id,
            "employee_id": leave.employee_id,
            "employee_name": leave.employee.full_name if leave.employee else "موظف غير معروف",
            "type": leave.type,
            "start_date": str(leave.start_date),
            "end_date": str(leave.end_date),
            "reason": leave.reason,
            "status": leave.status,
            "created_at": str(leave.created_at),
        }
        for leave in leaves
    ]


@router.post("/leaves")
def create_leave(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    # NOTE: validate up front — missing fields used to 500 on NOT NULL constraints.
    if not payload.get("employee_id") or not payload.get("start_date") or not payload.get("end_date"):
        raise HTTPException(
            status_code=400,
            detail="employee_id and start_date and end_date are required",
        )
    _require_employee_scope(current_user, int(payload["employee_id"]))
    # NOTE: Date columns need real date objects — raw strings 500 on sqlite.
    try:
        start_date = payload["start_date"] if isinstance(payload["start_date"], date) else date.fromisoformat(str(payload["start_date"]))
        end_date = payload["end_date"] if isinstance(payload["end_date"], date) else date.fromisoformat(str(payload["end_date"]))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="start_date and end_date must be YYYY-MM-DD dates",
        )
    leave = LeaveRequest(
        employee_id=payload.get("employee_id"),
        type=payload.get("type", "vacation"),
        start_date=start_date,
        end_date=end_date,
        reason=payload.get("reason"),
        status="pending",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return {
        "id": leave.id,
        "employee_id": leave.employee_id,
        "type": leave.type,
        "start_date": str(leave.start_date),
        "end_date": str(leave.end_date),
        "reason": leave.reason,
        "status": leave.status,
    }


@router.patch("/leaves/{leave_id}")
def update_leave_status(
    leave_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    leave.status = payload.get("status", leave.status)
    db.commit()
    db.refresh(leave)
    return {"id": leave.id, "status": leave.status, "message": "تم تحديث الطلب"}


# ========== Import/Export ==========

@router.post("/import-excel")
async def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Import attendance data from an Excel/CSV sheet (same engine as biometric)."""
    content = await validate_data_sheet(file, max_size=20 * 1024 * 1024)
    try:
        rows = _read_sheet_rows(content, file.filename or "")
        imported, errors = _bulk_import_rows(db, rows, source="excel")
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"فشل الاستيراد: {exc}") from exc

    try:
        await manager.broadcast({"event": "attendance_refresh", "message": "تم تحديث بيانات الحضور"})
    except Exception:
        pass

    return {
        "message": f"تم استيراد {imported} سجل بنجاح",
        "imported": imported,
        "errors": errors,
    }
