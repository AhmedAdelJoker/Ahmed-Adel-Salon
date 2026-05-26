from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.api.deps import require_any_staff, require_owner_or_manager
from app.models.user import User
from app.models.employee import Employee
from app.schemas.barber import BarberCreate, BarberRead, BarberUpdate

router = APIRouter(prefix="/barbers", tags=["Barbers"])


@router.get("", response_model=list[BarberRead])
def list_barbers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    pos_only: bool = False,
    booking_only: bool = False,
):
    # Backward compatibility: return only those marked to show in POS/Booking
    # or specifically with job_title='barber'
    query = db.query(Employee).filter(Employee.status == "active")
    
    if pos_only:
        query = query.filter(Employee.show_in_pos == True)
    elif booking_only:
        query = query.filter(Employee.show_in_booking == True)
    else:
        query = query.filter(
            (Employee.job_title == "barber") | (Employee.show_in_pos == True) | (Employee.show_in_booking == True)
        )
    
    if q:
        search = f"%{q}%"
        query = query.filter(
            (Employee.display_name.ilike(search)) | (Employee.full_name.ilike(search))
        )
    
    return query.order_by(Employee.display_order.asc(), Employee.id.desc()).offset(skip).limit(limit).all()


@router.get("/{barber_id}", response_model=BarberRead)
def get_barber(
    barber_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    return barber


@router.post("", response_model=BarberRead, status_code=status.HTTP_201_CREATED)
def create_barber(
    payload: BarberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # Map BarberCreate to Employee fields
    data = payload.model_dump()
    display_name = data.pop("display_name")
    phone = data.pop("phone")
    photo_url = data.pop("photo_url", None)
    bio_ar = data.pop("bio_ar", None)
    
    employee = Employee(
        full_name=display_name,
        display_name=display_name,
        phone_primary=phone or "000",
        profile_image_url=photo_url,
        personal_notes=bio_ar,
        job_title="barber",
        **data
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.put("/{barber_id}", response_model=BarberRead)
def update_barber(
    barber_id: int,
    payload: BarberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).filter(Employee.id == barber_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")

    update_data = payload.model_dump(exclude_unset=True)
    
    # Map fields
    if "display_name" in update_data:
        employee.display_name = update_data["display_name"]
        if not employee.full_name:
            employee.full_name = update_data["display_name"]
    if "phone" in update_data:
        employee.phone_primary = update_data["phone"]
    if "photo_url" in update_data:
        employee.profile_image_url = update_data["photo_url"]
    if "bio_ar" in update_data:
        employee.personal_notes = update_data["bio_ar"]

    # Remainder
    for field, value in update_data.items():
        if field not in ["display_name", "phone", "photo_url", "bio_ar"] and hasattr(employee, field):
            setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/{barber_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_barber(
    barber_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).filter(Employee.id == barber_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")

    db.delete(employee)
    db.commit()
    return None



