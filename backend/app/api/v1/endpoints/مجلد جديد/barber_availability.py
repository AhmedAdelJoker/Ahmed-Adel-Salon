from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.employee import Employee
from app.models.employee_working_hour import EmployeeWorkingHour
from app.models.employee_time_off import EmployeeTimeOff
from app.schemas.availability import BarberWorkingHourCreate, BarberWorkingHourRead, BarberTimeOffCreate, BarberTimeOffRead

router = APIRouter(prefix="/barber-availability", tags=["Barber Availability"])

@router.get("/{barber_id}/working-hours", response_model=list[BarberWorkingHourRead])
def list_working_hours(barber_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if not db.query(Employee).filter(Employee.id == barber_id).first():
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    return db.query(EmployeeWorkingHour).filter(EmployeeWorkingHour.employee_id == barber_id).order_by(EmployeeWorkingHour.day_of_week.asc()).all()

@router.post("/working-hours", response_model=BarberWorkingHourRead, status_code=status.HTTP_201_CREATED)
def create_working_hour(payload: BarberWorkingHourCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if not db.query(Employee).filter(Employee.id == payload.barber_id).first():
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # Map barber_id to employee_id for compatibility with schema
    data = payload.model_dump()
    if "barber_id" in data:
        data["employee_id"] = data.pop("barber_id")
        
    row = EmployeeWorkingHour(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.get("/{barber_id}/time-off", response_model=list[BarberTimeOffRead])
def list_time_off(barber_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if not db.query(Employee).filter(Employee.id == barber_id).first():
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    return db.query(EmployeeTimeOff).filter(EmployeeTimeOff.employee_id == barber_id).order_by(EmployeeTimeOff.off_date.asc()).all()

@router.post("/time-off", response_model=BarberTimeOffRead, status_code=status.HTTP_201_CREATED)
def create_time_off(payload: BarberTimeOffCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if not db.query(Employee).filter(Employee.id == payload.barber_id).first():
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # Map barber_id to employee_id for compatibility with schema
    data = payload.model_dump()
    if "barber_id" in data:
        data["employee_id"] = data.pop("barber_id")
        
    row = EmployeeTimeOff(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row



