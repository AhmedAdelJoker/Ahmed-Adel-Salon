from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.api.deps_auth import get_current_active_user
from app.models.user import User
from app.schemas.profile import ProfileRead, ProfileUpdate, ChangePasswordPayload
from app.core.security import verify_password, get_password_hash
from app.core.upload_security import validate_image
from app.utils.media import process_image_content, get_upload_path

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=ProfileRead)
def read_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Fallback to employee profile image if user one is not set
    profile_image_url = current_user.profile_image_url
    if not profile_image_url and current_user.employee:
        profile_image_url = current_user.employee.profile_image_url
    
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "display_name": current_user.display_name,
        "bio_ar": current_user.bio_ar,
        "profile_image_url": profile_image_url,
        "barber_id": current_user.employee_id
    }


@router.post("/avatar", response_model=ProfileRead)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image(file, max_size=5 * 1024 * 1024)
    upload_dir = get_upload_path("profiles")
    filename = process_image_content(content, file.filename, upload_dir)
    
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
    current_user.token_version = int(current_user.token_version or 0) + 1
    db.add(current_user)
    db.commit()

    return {"message": "تم تغيير كلمة المرور بنجاح"}