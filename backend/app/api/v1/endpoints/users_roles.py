from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.barber import Barber
from app.schemas.user_role import UserCreate, UserRead, UserRoleUpdate, UserActiveUpdate
from app.core.security import get_password_hash
from app.core.roles import UserRole, normalize_role

router = APIRouter(prefix="/users", tags=["Users Roles Management"])
ALLOWED_ROLES = {
    UserRole.ADMIN.value,
    UserRole.MANAGER.value,
    UserRole.CASHIER.value,
    UserRole.BARBER.value,
}

@router.get("", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    return db.query(User).order_by(User.id.desc()).all()

@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    normalized_role = normalize_role(payload.role)
    if normalized_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="الدور غير صالح")
    if normalized_role == UserRole.BARBER.value and payload.barber_id is None:
        raise HTTPException(status_code=400, detail="يجب ربط الحلاق بحساب barber_id")
    if payload.barber_id is not None and not db.query(Barber).filter(Barber.id == payload.barber_id).first():
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    user = User(
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        email=payload.email,
        role=normalized_role,
        barber_id=payload.barber_id if normalized_role == UserRole.BARBER.value else None,
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
