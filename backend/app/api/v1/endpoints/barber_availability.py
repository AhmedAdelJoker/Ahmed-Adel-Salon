from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.employee import Employee
from app.models.employee_working_hour import EmployeeWorkingHour
from app.models.employee_time_off import EmployeeTimeOff
from app.schemas.availability import (
    BarberWorkingHourCreate,
    BarberWorkingHourRead,
    BarberTimeOffCreate,
    BarberTimeOffRead,
)

router = APIRouter(prefix="/barber-availability", tags=["Barber Availability"])


def _ensure_employee(db: Session, employee_id: int) -> None:
    """Reject requests for non-existent employees."""
    if not db.query(Employee).filter(Employee.id == employee_id).first():
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")


@router.get("/{barber_id}/working-hours", response_model=list[BarberWorkingHourRead])
def list_working_hours(
    barber_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # Phase 2: prefer Employee, fall back to Barber for backwards compatibility
    employee = (
        db.query(Employee).filter(Employee.id == barber_id).first()
    )
    if not employee:
        # Legacy fallback
        from app.models.barber import Barber
        if not db.query(Barber).filter(Barber.id == barber_id).first():
            raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    return (
        db.query(EmployeeWorkingHour)
        .filter(EmployeeWorkingHour.employee_id == barber_id)
        .order_by(EmployeeWorkingHour.day_of_week.asc())
        .all()
    )


@router.post(
    "/working-hours",
    response_model=BarberWorkingHourRead,
    status_code=status.HTTP_201_CREATED,
)
def create_working_hour(
    payload: BarberWorkingHourCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    _ensure_employee(db, payload.barber_id)
    data = payload.model_dump()
    # Map legacy field to the unified schema
    data["employee_id"] = data.pop("barber_id")
    row = EmployeeWorkingHour(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{barber_id}/time-off", response_model=list[BarberTimeOffRead])
def list_time_off(
    barber_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).filter(Employee.id == barber_id).first()
    if not employee:
        from app.models.barber import Barber
        if not db.query(Barber).filter(Barber.id == barber_id).first():
            raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    return (
        db.query(EmployeeTimeOff)
        .filter(EmployeeTimeOff.employee_id == barber_id)
        .order_by(EmployeeTimeOff.off_date.asc())
        .all()
    )


@router.post(
    "/time-off",
    response_model=BarberTimeOffRead,
    status_code=status.HTTP_201_CREATED,
)
def create_time_off(
    payload: BarberTimeOffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    _ensure_employee(db, payload.barber_id)
    data = payload.model_dump()
    data["employee_id"] = data.pop("barber_id")
    row = EmployeeTimeOff(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
