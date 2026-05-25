from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.barber import Barber
from app.models.barber_working_hour import BarberWorkingHour
from app.models.barber_time_off import BarberTimeOff
from app.schemas.availability import BarberWorkingHourCreate, BarberWorkingHourRead, BarberTimeOffCreate, BarberTimeOffRead

router = APIRouter(prefix="/barber-availability", tags=["Barber Availability"])

@router.get("/{barber_id}/working-hours", response_model=list[BarberWorkingHourRead])
def list_working_hours(barber_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if not db.query(Barber).filter(Barber.id == barber_id).first():
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    return db.query(BarberWorkingHour).filter(BarberWorkingHour.barber_id == barber_id).order_by(BarberWorkingHour.day_of_week.asc()).all()

@router.post("/working-hours", response_model=BarberWorkingHourRead, status_code=status.HTTP_201_CREATED)
def create_working_hour(payload: BarberWorkingHourCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if not db.query(Barber).filter(Barber.id == payload.barber_id).first():
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    row = BarberWorkingHour(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.get("/{barber_id}/time-off", response_model=list[BarberTimeOffRead])
def list_time_off(barber_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if not db.query(Barber).filter(Barber.id == barber_id).first():
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    return db.query(BarberTimeOff).filter(BarberTimeOff.barber_id == barber_id).order_by(BarberTimeOff.off_date.asc()).all()

@router.post("/time-off", response_model=BarberTimeOffRead, status_code=status.HTTP_201_CREATED)
def create_time_off(payload: BarberTimeOffCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if not db.query(Barber).filter(Barber.id == payload.barber_id).first():
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    row = BarberTimeOff(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
