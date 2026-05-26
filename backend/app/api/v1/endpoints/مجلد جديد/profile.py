from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.api.deps_auth import get_current_active_user
from app.models.user import User
from app.schemas.profile import ProfileRead, ProfileUpdate, ChangePasswordPayload
from app.core.security import verify_password, get_password_hash

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
import os
import uuid
import shutil

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=ProfileRead)
def read_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Flatten employee fields if linked
    display_name = None
    bio_ar = None
    profile_image_url = current_user.profile_image_url

    if current_user.employee:
        display_name = current_user.employee.display_name
        bio_ar = current_user.employee.bio_ar
        # Use employee image if user image is null
        if not profile_image_url:
            profile_image_url = current_user.employee.profile_image_url
    
    # Create a wrapper or use Pydantic from_dict
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "display_name": display_name,
        "bio_ar": bio_ar,
        "profile_image_url": profile_image_url,
        "barber_id": current_user.employee_id
    }


@router.post("/avatar", response_model=ProfileRead)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="صيغة الصورة غير مدعومة. الصيغ المسموحة: JPG, PNG, WEBP",
        )

    # Ensure directory exists
    os.makedirs("uploads/profiles", exist_ok=True)
    
    # Generate unique filename
    filename = f"{uuid.uuid4()}{ext}"
    file_path = f"uploads/profiles/{filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Save path in DB (relative URL)
    relative_path = f"/uploads/profiles/{filename}"
    current_user.profile_image_url = relative_path
    
    # If user is linked to an employee, update employee image too for synchronization
    if current_user.employee:
        current_user.employee.profile_image_url = relative_path
        db.add(current_user.employee)
        
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return read_profile(db=db, current_user=current_user)


@router.put("", response_model=ProfileRead)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    if payload.email is not None:
        current_user.email = payload.email

    # Update employee details if linked
    if current_user.employee:
        if payload.display_name is not None:
            current_user.employee.display_name = payload.display_name
        if payload.bio_ar is not None:
            current_user.employee.bio_ar = payload.bio_ar
        db.add(current_user.employee)

    db.add(current_user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="البريد الإلكتروني مستخدم بالفعل",
        )

    db.refresh(current_user)
    return read_profile(db=db, current_user=current_user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمة المرور الحالية غير صحيحة",
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()

    return {"message": "تم تغيير كلمة المرور بنجاح"}


