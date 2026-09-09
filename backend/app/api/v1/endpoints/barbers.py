from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.api.deps import require_any_staff, require_owner_or_manager
from app.models.user import User
from app.models.employee import Employee
from app.schemas.employee import EmployeeListItem, EmployeeRead

router = APIRouter(prefix="/barbers", tags=["Barbers"])


class BarberProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None
    commission_rate: Optional[float] = None
    avatar_url: Optional[str] = None

@router.get("", response_model=list[EmployeeListItem])
def list_barbers(
    limit: int = Query(100, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    """
    Returns employees whose job_title includes 'barber' to satisfy legacy 'barbers' endpoint
    """
    barbers = db.query(Employee).options(joinedload(Employee.services)).filter(
        Employee.job_title.ilike("%barber%"),
        Employee.is_active == True
    ).order_by(Employee.display_order.asc()).offset(offset).limit(limit).all()
    
    # Map service_ids for the frontend filtering
    for b in barbers:
        b.service_ids = [s.id for s in b.services]
        
    return barbers

@router.get("/{barber_id}", response_model=EmployeeRead)
def get_barber(
    barber_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    barber = db.query(Employee).options(joinedload(Employee.services)).filter(Employee.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    return barber

@router.put("/{barber_id}", response_model=EmployeeRead)
def update_barber_profile(
    barber_id: int,
    payload: BarberProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    if current_user.role == "barber":
        resolved = current_user.barber_id or current_user.employee_id
        if resolved != barber_id:
            raise HTTPException(status_code=403, detail="غير مصرح لك بتعديل هذا الملف")
    mapping = {
        "full_name": "full_name",
        "phone": "phone",
        "email": "email",
        "address": "address",
        "bio": "bio",
        "commission_rate": "commission_rate",
        "avatar_url": "profile_image_url",
    }
    for field, col in mapping.items():
        value = getattr(payload, field, None)
        if value is not None and hasattr(barber, col):
            setattr(barber, col, value)
    db.commit()
    db.refresh(barber)
    return barber


@router.post("/upload-image")
def upload_barber_image(
    current_user: User = Depends(require_owner_or_manager),
):
    return {"message": "Please use /employees/upload-image", "url": "/uploads/profiles/default.png"}
