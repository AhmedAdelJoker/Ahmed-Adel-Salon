"""Legacy /attendance router — kept only for fingerprint-device integration.

This router used to duplicate the whole attendance feature with weaker rules:
`/attendance/register` accepted duplicate check-ins (no state machine, no
late-reason policy, no penalty rows, `datetime.now()` instead of the salon
clock), and both import endpoints re-implemented parsing that had already
drifted away from the canonical copies. Every write now goes through
`app.services.attendance_service.apply_punch`, and the duplicate read/import
endpoints are gone — `/barber-presence` is the one API the frontend consumes.

`/attendance/fingerprint` survives because the physical device posts here
(query params, rate-limited). It records through the same `apply_punch` engine
as the manual register, so a device punch obeys the same state machine, late
policy and penalty accounting as everything else.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, date

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.core.rate_limit import rate_limit
from app.services.activity_log_service import log_activity
from app.services.attendance_service import apply_punch

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/logs")
def get_attendance_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
    employee_id: Optional[int] = None,
    limit: int = Query(100, ge=1, le=1000),
):
    from app.models.employee_presence_log import EmployeePresenceLog

    query = db.query(EmployeePresenceLog)
    if employee_id:
        query = query.filter(EmployeePresenceLog.employee_id == employee_id)

    logs = query.order_by(EmployeePresenceLog.created_at.desc()).limit(limit).all()

    return [
        {
            "id": log.id,
            "barber_id": log.employee_id,
            "barber_name": log.employee.full_name if log.employee else "Unknown",
            "employee_id": log.employee_id,
            "employee_name": log.employee.full_name if log.employee else "Unknown",
            "status": log.status,
            "is_late": bool(log.is_late),
            "late_reason": log.late_reason,
            "created_at": log.created_at,
        }
        for log in logs
    ]


@router.get("/employee-summary")
def get_employee_attendance_summary(
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    from app.models.employee import Employee
    from app.models.employee_presence_log import EmployeePresenceLog

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    query = db.query(EmployeePresenceLog).filter(EmployeePresenceLog.employee_id == employee_id)

    if start_date:
        query = query.filter(EmployeePresenceLog.created_at >= datetime.combine(start_date, datetime.min.time()))

    if end_date:
        query = query.filter(EmployeePresenceLog.created_at <= datetime.combine(end_date, datetime.max.time()))

    logs = query.order_by(EmployeePresenceLog.created_at.desc()).all()
    check_ins = sum(1 for item in logs if item.status == "in")
    check_outs = sum(1 for item in logs if item.status == "out")
    last_log = logs[0] if logs else None

    return {
        "employee_id": employee.id,
        "employee_name": employee.full_name,
        "total_logs": len(logs),
        "check_ins": check_ins,
        "check_outs": check_outs,
        "current_status": last_log.status if last_log else None,
        "last_seen_at": last_log.created_at if last_log else None,
    }


@router.post(
    "/fingerprint",
    dependencies=[Depends(rate_limit("attendance_fingerprint", max_requests=30, window_seconds=60))],
)
def fingerprint_attendance(
    employee_id: int,
    type: str,  # "in" or "out" (break statuses also accepted)
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """Endpoint for Fingerprint Device Integration - requires authentication.

    Records through the same engine as the manual register: state-machine
    guards, late policy and penalty rows all apply, and the timestamp is the
    salon clock rather than the server's local time.
    """
    result = apply_punch(
        db,
        employee_id=employee_id,
        status_type=type,
        source="biometric",
        # The device cannot type a reason; dropping the punch would lose the
        # attendance event. It is still marked late with a penalty row.
        require_late_reason=False,
    )

    log_activity(
        db,
        user_id=current_user.id,
        action="fingerprint",
        entity_type="attendance",
        description=f"بصمة {type} للموظف {result['employee_name']} عبر الجهاز",
    )

    return {"status": "success", "employee": result["employee_name"]}
