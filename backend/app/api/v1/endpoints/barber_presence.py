from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, and_
from datetime import datetime, timedelta, date
from typing import Optional
import csv
import io
import json

from app.db.session import get_db
from app.api.deps import require_any_staff, require_cashier_manager_owner
from app.models.user import User
from app.models.employee import Employee
from app.models.employee_presence_log import EmployeePresenceLog, AttendanceArchive, AttendancePenalty
from app.models.leave_request import LeaveRequest
from app.models.business_settings import BusinessSettings
from app.core.upload_security import validate_data_sheet
from app.services.websocket import manager

router = APIRouter(prefix="/barber-presence", tags=["Attendance"])

LATE_THRESHOLD_MINUTES = 15
PENALTY_PER_LATE_MINUTE = 0.5  # Currency per minute late


def _is_late_for_shift(db: Session, dt: datetime) -> tuple:
    """Check if check-in is late. Returns (is_late, expected_time_str, late_minutes)."""
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return False, None, 0
    
    day_name = dt.strftime("%A").lower()
    day_config = settings.working_hours.get(day_name, {})
    
    if not day_config.get("is_open", True) or not day_config.get("open_time"):
        return False, None, 0
    
    try:
        start_str = day_config["open_time"]
        start_time = datetime.strptime(start_str, "%H:%M").time()
        current_time = dt.time()
        start_minutes = start_time.hour * 60 + start_time.minute
        current_minutes = current_time.hour * 60 + current_time.minute
        diff = current_minutes - start_minutes
        
        if diff > LATE_THRESHOLD_MINUTES:
            return True, start_str, diff
        return False, start_str, 0
    except Exception:
        return False, None, 0


def _get_employee_status(db: Session, employee_id: int) -> dict:
    """Get current employee status based on today's logs."""
    today = date.today()
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
        log_entry = {
            "id": log.id,
            "status": log.status,
            "is_late": log.is_late,
            "late_minutes": log.late_minutes,
            "late_reason": log.late_reason,
            "source": log.source,
            "created_at": log_time.isoformat() if log_time else None,
        }
        logs_data.append(log_entry)
        
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
        "last_log": {
            "id": last_log.id,
            "status": last_log.status,
            "is_late": last_log.is_late,
            "late_minutes": last_log.late_minutes,
            "late_reason": last_log.late_reason,
            "source": last_log.source,
            "created_at": last_log.created_at.isoformat() if last_log.created_at else None,
        } if last_log else None,
        "total_worked_minutes": round(total_minutes),
        "total_worked_hours": round(total_minutes / 60, 1),
        "logs_today": logs_data,
        "is_late": last_log.is_late if last_log and last_log.status == "in" else False,
        "late_reason": last_log.late_reason if last_log and last_log.is_late else None,
    }


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
        day_name = datetime.now().strftime("%A").lower()
        day_config = settings.working_hours.get(day_name, {})
        if day_config.get("is_open") and day_config.get("close_time"):
            close_str = day_config["close_time"]
            now = datetime.now()
            try:
                close_h, close_m = map(int, close_str.split(":"))
                close_dt = now.replace(hour=close_h, minute=close_m, second=0)
                diff = int((close_dt - now).total_seconds() / 60)
                if diff > 0:
                    h, m = divmod(diff, 60)
                    remaining_shift = f"{h}س {m}د"
                else:
                    remaining_shift = "انتهت"
            except Exception:
                pass
    
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
    """تسجيل يدوي - المدير/المالك/الكاشير"""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    if status_type not in ("in", "out", "break", "break_end"):
        raise HTTPException(status_code=400, detail="نوع العملية غير صحيح")
    
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp)
        except ValueError:
            raise HTTPException(status_code=400, detail="تنسيق الوقت غير صحيح")
    else:
        dt = datetime.now()
    
    # Check current status
    emp_status = _get_employee_status(db, employee_id)
    current = emp_status["current_status"]
    
    if status_type == "in" and current == "in":
        raise HTTPException(status_code=400, detail="الموظف مسجل حضوره بالفعل. يرجى تسجيل انصراف أولاً.")
    if status_type == "out" and current == "out":
        raise HTTPException(status_code=400, detail="الموظف مسجل انصرافه بالفعل. يرجى تسجيل حضور أولاً.")
    if status_type == "break" and current != "in":
        raise HTTPException(status_code=400, detail="يجب تسجيل الحضور أولاً.")
    if status_type == "break_end" and current != "break":
        raise HTTPException(status_code=400, detail="الموظف ليس في استراحة.")
    
    # Check if late
    is_late, expected_time, late_minutes = _is_late_for_shift(db, dt)
    
    if is_late and status_type == "in" and (not late_reason or not late_reason.strip()):
        raise HTTPException(
            status_code=400, 
            detail=f"تسجيل متأخر {late_minutes} دقيقة عن الموعد ({expected_time}). يرجى كتابة سبب التأخير."
        )
    
    log = EmployeePresenceLog(
        employee_id=employee_id,
        status=status_type,
        created_at=dt,
        is_late=is_late if status_type == "in" else False,
        late_minutes=late_minutes if is_late and status_type == "in" else 0,
        late_reason=late_reason if is_late and status_type == "in" else None,
        source="manual",
    )
    db.add(log)
    
    # Create penalty if late
    if is_late and status_type == "in" and late_minutes > 0:
        penalty = AttendancePenalty(
            employee_id=employee_id,
            date=dt.date(),
            late_minutes=late_minutes,
            reason=late_reason,
            penalty_amount=late_minutes * PENALTY_PER_LATE_MINUTE,
        )
        db.add(penalty)
    
    db.commit()
    
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
    
    return {"message": "تم التسجيل بنجاح", "is_late": is_late, "late_minutes": late_minutes}


@router.post("/import-biometric")
async def import_biometric(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Import attendance data from biometric device CSV/Excel file."""
    # Phase 3: validate MIME/size/filename
    content = await validate_data_sheet(file, max_size=20 * 1024 * 1024)
    decoded = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    
    for row_num, row in enumerate(reader, start=2):
        try:
            # Expected columns: employee_id, date, time, status (or similar)
            emp_id = row.get("employee_id") or row.get("emp_id") or row.get("id") or row.get("الرقم")
            date_str = row.get("date") or row.get("التاريخ") or row.get("DATE")
            time_str = row.get("time") or row.get("الوقت") or row.get("TIME")
            status = row.get("status") or row.get("الحالة") or row.get("STATUS") or "in"
            
            if not emp_id:
                errors.append(f"صف {row_num}: رقم الموظف مفقود")
                continue
            
            emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
            if not emp:
                errors.append(f"صف {row_num}: موظف غير موجود ({emp_id})")
                continue
            
            # Parse datetime
            if date_str and time_str:
                try:
                    dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    try:
                        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
                    except ValueError:
                        dt = datetime.now()
            else:
                dt = datetime.now()
            
            # Normalize status
            status_lower = str(status).lower().strip()
            if status_lower in ("in", "حضور", "دخول", "check-in"):
                status_type = "in"
            elif status_lower in ("out", "انصراف", "خروج", "check-out"):
                status_type = "out"
            elif status_lower in ("break", "استراحة"):
                status_type = "break"
            else:
                status_type = "in"
            
            is_late, _, late_minutes = _is_late_for_shift(db, dt)
            
            log = EmployeePresenceLog(
                employee_id=int(emp_id),
                status=status_type,
                created_at=dt,
                is_late=is_late if status_type == "in" else False,
                late_minutes=late_minutes if is_late and status_type == "in" else 0,
                source="biometric",
            )
            db.add(log)
            imported += 1
            
        except Exception as e:
            errors.append(f"صف {row_num}: {str(e)}")
    
    db.commit()
    
    # Broadcast attendance refresh after bulk import
    try:
        await manager.broadcast({
            "event": "attendance_refresh",
            "message": "تم تحديث بيانات الحضور",
        })
    except Exception:
        pass
    
    return {"message": f"تم استيراد {imported} سجل", "imported": imported, "errors": errors}


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
        year_month = datetime.now().strftime("%Y-%m")

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

        analytics.append({
            "employee_id": emp.id,
            "employee_name": emp.full_name,
            "work_days": len(work_days),
            "total_work_hours": round(total_work_minutes / 60, 1),
            "total_work_minutes": round(total_work_minutes),
            "late_count": late_count,
            "total_late_minutes": total_late_minutes,
            "avg_daily_hours": round(avg_daily / 60, 1),
            "penalty_amount": total_late_minutes * PENALTY_PER_LATE_MINUTE,
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
    return {"working_hours": settings.working_hours if settings else {}}


@router.post("/working-hours")
def update_working_hours(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    settings = db.query(BusinessSettings).first()
    if not settings:
        settings = BusinessSettings()
        db.add(settings)
    settings.working_hours = payload.get("working_hours", {})
    db.commit()
    db.refresh(settings)
    return {"working_hours": settings.working_hours, "message": "تم حفظ الإعدادات بنجاح"}


# ========== Leave Management ==========

@router.get("/leaves")
def get_leaves(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    query = db.query(LeaveRequest).options(joinedload(LeaveRequest.employee))
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
    current_user: User = Depends(require_cashier_manager_owner),
):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    leave.status = payload.get("status", leave.status)
    db.commit()
    db.refresh(leave)
    return {"id": leave.id, "status": leave.status, "message": "تم تحديث الطلب"}


# ========== Import/Export ==========

@router.post("/import-biometric")
async def import_biometric(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    # Phase 3: validate MIME/size/filename
    content = await validate_data_sheet(file, max_size=20 * 1024 * 1024)
    try:
        decoded = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(decoded))
        imported = 0
        for row in reader:
            emp_id = row.get("employee_id") or row.get("emp_id") or row.get("id")
            if not emp_id:
                continue
            status_type = row.get("status") or row.get("type") or "in"
            timestamp = row.get("timestamp") or row.get("time") or row.get("created_at")
            log = EmployeePresenceLog(
                employee_id=int(emp_id),
                status=status_type,
                source="biometric",
            )
            if timestamp:
                try:
                    log.created_at = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                except Exception:
                    pass
            db.add(log)
            imported += 1
        db.commit()
        return {"message": f"تم استيراد {imported} سجل بنجاح", "imported": imported}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فشل الاستيراد: {str(e)}")


@router.post("/import-excel")
async def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    # Phase 3: validate MIME/size/filename
    content = await validate_data_sheet(file, max_size=20 * 1024 * 1024)
    try:
        decoded = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(decoded))
        imported = 0
        for row in reader:
            emp_id = row.get("employee_id") or row.get("emp_id") or row.get("id")
            if not emp_id:
                continue
            status_type = row.get("status") or row.get("type") or "in"
            timestamp = row.get("timestamp") or row.get("time") or row.get("created_at")
            log = EmployeePresenceLog(
                employee_id=int(emp_id),
                status=status_type,
                source="excel",
            )
            if timestamp:
                try:
                    log.created_at = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                except Exception:
                    pass
            db.add(log)
            imported += 1
        db.commit()
        return {"message": f"تم استيراد {imported} سجل بنجاح", "imported": imported}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فشل الاستيراد: {str(e)}")
