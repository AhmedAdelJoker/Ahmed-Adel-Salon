from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.barber import Barber
from app.schemas.user_role import UserCreate, UserRead, UserRoleUpdate, UserActiveUpdate, UserUpdate
from app.core.security import get_password_hash
from app.core.roles import UserRole, normalize_role

router = APIRouter(prefix="/users", tags=["Users Roles Management"])
ALLOWED_ROLES = {
    UserRole.OWNER.value,
    UserRole.ADMIN.value,
    UserRole.MANAGER.value,
    UserRole.CASHIER.value,
    UserRole.BARBER.value,
    UserRole.ACCOUNTANT.value,
}

@router.get("", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    users = db.query(User).order_by(User.id.desc()).all()
    for user in users:
        if user.employee:
            if not user.profile_image_url:
                user.profile_image_url = user.employee.profile_image_url
            user.job_title = user.employee.job_title
    return users

@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    normalized_role = normalize_role(payload.role)
    if normalized_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="الدور غير صالح")
    
    user = User(
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        email=payload.email,
        role=normalized_role,
        is_active=payload.is_active,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="اسم المستخدم مستخدم بالفعل")
    db.refresh(user)
    return user

@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if user.employee:
        if not user.profile_image_url:
            user.profile_image_url = user.employee.profile_image_url
        user.job_title = user.employee.job_title
    return user


@router.patch("/{user_id}", response_model=UserRead)
def partial_update_user(user_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    # Only allow specific fields to be updated
    allowed_fields = ["full_name", "email", "profile_image_url", "barber_id", "is_active"]
    for field, value in payload.items():
        if field in allowed_fields:
            setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    if user.employee:
        if not user.profile_image_url:
            user.profile_image_url = user.employee.profile_image_url
        user.job_title = user.employee.job_title
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    normalized_role = normalize_role(payload.role)
    if normalized_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="الدور غير صالح")
        
    user.full_name = payload.full_name
    user.email = payload.email
    user.role = normalized_role
    user.is_active = payload.is_active
    
    if payload.password: # If password provided, update it
        user.hashed_password = get_password_hash(payload.password)
        
    db.commit()
    db.refresh(user)
    return user

@router.patch("/{user_id}/role", response_model=UserRead)
def update_user_role(user_id: int, payload: UserRoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    normalized_role = normalize_role(payload.role)
    if normalized_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="الدور غير صالح")
    if normalized_role != UserRole.BARBER.value:
        user.barber_id = None
    user.role = normalized_role
    db.commit()
    db.refresh(user)
    return user

@router.patch("/{user_id}/active", response_model=UserRead)
def update_user_active(user_id: int, payload: UserActiveUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="لا يمكن حذف حسابك الحالي")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")

    if user.employee:
        user.employee.user_id = None
    try:
        db.delete(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        user.is_active = False
        db.commit()
    return None
