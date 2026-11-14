from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.api.deps import (
    require_any_staff,
    require_barber_or_manager,
)
from app.core.employee_rules import SERVICE_PROVIDER_JOB_TITLES
from app.core.upload_security import validate_image
from app.models.user import User
from app.models.employee import Employee
from app.schemas.employee import EmployeeListItem, EmployeeRead
from app.utils.media import process_image_content, get_upload_path

router = APIRouter(prefix="/barbers", tags=["Barbers"])

# Assistants accompany a barber and are kept visible in staff pickers, but
# never count as service providers (they cannot be booked or chosen as the
# performer of a paid service).
STAFF_PICKER_JOB_TITLES = (*SERVICE_PROVIDER_JOB_TITLES, "barber_assistant")

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
    Staff pickers for the internal schedule: every service-providing title
    (barber, colorist, esthetician) plus assistants. The legacy
    `ILIKE '%barber%'` matched barbers and assistants but hid the colour and
    skin specialists from scheduling surfaces entirely.
    """
    barbers = db.query(Employee).options(joinedload(Employee.services)).filter(
        Employee.job_title.in_(list(STAFF_PICKER_JOB_TITLES)),
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
    current_user: User = Depends(require_barber_or_manager),
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
        "phone": "phone_primary",
        "address": "detailed_address",
        "bio": "bio_ar",
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
async def upload_barber_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_barber_or_manager),
):
    """
    Store a barber's photo and point the barber's row at it.

    This used to be a stub that accepted no file at all and answered with
    `/uploads/profiles/default.png` — a path nothing ever writes and nothing
    serves, so any caller that trusted it rendered a broken image. It now does
    what the caller asked, and like `employees/upload-image` it returns a
    relative path under `/uploads/profiles`, which is mounted statically.
    """
    content = await validate_image(file, max_size=5 * 1024 * 1024)
    upload_dir = get_upload_path("profiles")
    filename = process_image_content(content, file.filename, upload_dir)
    url = f"/uploads/profiles/{filename}"

    # A manager may upload a photo for any barber; a barber only their own, and
    # `require_barber_or_manager` already admits staff above a barber.
    target_id = (
        current_user.barber_id
        if current_user.role == "barber"
        else None
    )
    if target_id is not None:
        barber = db.query(Employee).filter(Employee.id == target_id).first()
        if barber is not None:
            barber.profile_image_url = url
            db.add(barber)
            db.commit()

    return {"url": url}
