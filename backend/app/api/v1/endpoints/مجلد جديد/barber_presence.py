from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_any_staff, require_barber_only
from app.models.user import User
from app.models.employee_presence_log import EmployeePresenceLog

from app.schemas.barber_presence import BarberPresenceRead

router = APIRouter(prefix="/barber-presence", tags=["Barber Presence"])

@router.post("/check-in")
def barber_check_in(db: Session = Depends(get_db), current_user: User = Depends(require_barber_only)):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="هذا المستخدم غير مربوط بموظف")
    db.add(EmployeePresenceLog(employee_id=current_user.employee_id, status="in"))
    db.commit()
    return {"message": "تم تسجيل الحضور"}

@router.post("/check-out")
def barber_check_out(db: Session = Depends(get_db), current_user: User = Depends(require_barber_only)):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="هذا المستخدم غير مربوط بموظف")
    db.add(EmployeePresenceLog(employee_id=current_user.employee_id, status="out"))
    db.commit()
    return {"message": "تم تسجيل الانصراف"}

@router.get("/current", response_model=list[BarberPresenceRead])
def get_current_presence(db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    from app.models.employee import Employee
    rows = db.query(EmployeePresenceLog).options(joinedload(EmployeePresenceLog.employee)).order_by(EmployeePresenceLog.id.desc()).all()
    latest_per_employee = {}
    for row in rows:
        if row.employee_id not in latest_per_employee:
            latest_per_employee[row.employee_id] = {
                "employee_id": row.employee_id,
                "employee_name": row.employee.full_name if row.employee else "Unknown",
                "status": row.status,
                "created_at": row.created_at
            }
    return list(latest_per_employee.values())



