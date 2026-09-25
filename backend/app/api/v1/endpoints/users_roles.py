from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_roles
from app.models.user import User
from app.models.barber import Barber
from app.schemas.user_role import UserCreate, UserRead, UserRoleUpdate, UserActiveUpdate, UserUpdate
from app.core.security import get_password_hash
from app.core.roles import UserRole, normalize_role
from app.core.rbac import can_access

require_manage_users = require_roles("owner", "admin")

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
def list_users(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_users),
):
    query = db.query(User).order_by(User.id.desc())
    response.headers["X-Total-Count"] = str(query.count())
    users = query.offset(skip).limit(limit).all()
    for user in users:
        if user.employee:
            if not user.profile_image_url:
                user.profile_image_url = user.employee.profile_image_url
            user.job_title = user.employee.job_title
    return users

@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manage_users)):
    normalized_role = normalize_role(payload.role)
    if normalized_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="الدور غير صالح")
    if not can_access(normalized_role, current_user.role):
        raise HTTPException(status_code=403, detail="لا يمكنك إنشاء مستخدم بدور أعلى من دورك")
    
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
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_manage_users)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if user.employee:
        if not user.profile_image_url:
            user.profile_image_url = user.employee.profile_image_url
        user.job_title = user.employee.job_title
    return user


@router.patch("/{user_id}", response_model=UserRead)
def partial_update_user(user_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(require_manage_users)):
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
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_manage_users)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")

    normalized_role = normalize_role(payload.role)
    if normalized_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="الدور غير صالح")
    if not can_access(normalized_role, current_user.role):
        raise HTTPException(status_code=403, detail="لا يمكنك تعيين دور أعلى من دورك")
    if not can_access(user.role, current_user.role):
        raise HTTPException(status_code=403, detail="لا يمكنك تعديل مستخدم بدور أعلى من دورك")
        
    user.full_name = payload.full_name
    user.email = payload.email
    if normalized_role != user.role:
        user.role = normalized_role
        user.token_version = int(user.token_version or 0) + 1
    user.is_active = payload.is_active
    
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)
        user.token_version = int(user.token_version or 0) + 1
        
    db.commit()
    db.refresh(user)
    return user

@router.patch("/{user_id}/role", response_model=UserRead)
def update_user_role(user_id: int, payload: UserRoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_manage_users)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    normalized_role = normalize_role(payload.role)
    if normalized_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="الدور غير صالح")
    if not can_access(normalized_role, current_user.role):
        raise HTTPException(status_code=403, detail="لا يمكنك تعيين دور أعلى من دورك")
    if not can_access(user.role, current_user.role):
        raise HTTPException(status_code=403, detail="لا يمكنك تعديل مستخدم بدور أعلى من دورك")
    if normalized_role != UserRole.BARBER.value:
        user.barber_id = None
    if normalized_role != user.role:
        user.role = normalized_role
        user.token_version = int(user.token_version or 0) + 1
    db.commit()
    db.refresh(user)
    return user

@router.patch("/{user_id}/active", response_model=UserRead)
def update_user_active(user_id: int, payload: UserActiveUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_manage_users)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if not can_access(user.role, current_user.role):
        raise HTTPException(status_code=403, detail="لا يمكنك تعديل مستخدم بدور أعلى من دورك")
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_manage_users)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="لا يمكن حذف حسابك الحالي")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if not can_access(user.role, current_user.role):
        raise HTTPException(status_code=403, detail="لا يمكنك حذف مستخدم بدور أعلى من دورك")

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
