from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_roles
from app.models.user import User
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
        permissions=payload.permissions,
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

    # Hierarchy guard, matching PUT and PATCH /role: without it an `admin`
    # (level 90) could rename, re-mail or deactivate an `owner` (level 100)
    # through this endpoint while every other route correctly refuses.
    if not can_access(user.role, current_user.role):
        raise HTTPException(status_code=403, detail="لا يمكنك تعديل مستخدم بدور أعلى من دورك")

    # Only allow specific fields to be updated
    allowed_fields = ["full_name", "email", "profile_image_url", "barber_id", "is_active"]
    for field, value in payload.items():
        if field in allowed_fields:
            setattr(user, field, value)

    # barber_id references employees.id; an unvalidated value turns the next
    # flush into a 500 (or a silent dangling pointer where FKs are off).
    if "barber_id" in payload and payload["barber_id"] is not None:
        from app.models.employee import Employee

        exists = db.query(Employee.id).filter(Employee.id == payload["barber_id"]).first()
        if not exists:
            raise HTTPException(status_code=400, detail="الحلاق المحدد غير موجود")

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

    # The edit form sends username as a first-class field, so honour it.
    # JWTs carry `sub=username`, so existing sessions of this user keep
    # working only until the username lookup changes — a rename is
    # effectively a session-terminating event for the affected account.
    new_username = payload.username.strip()
    if new_username != user.username:
        if db.query(User.id).filter(User.username == new_username, User.id != user.id).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="اسم المستخدم مستخدم بالفعل")
        user.username = new_username

    user.full_name = payload.full_name
    user.email = payload.email
    if normalized_role != user.role:
        user.role = normalized_role
        user.token_version = int(user.token_version or 0) + 1
    user.is_active = payload.is_active

    # Absent key = no change; explicit {} = reset to role defaults. The
    # permissions dialog always sends the full override map it edited.
    if payload.permissions is not None:
        user.permissions = payload.permissions

    if payload.password:
        user.hashed_password = get_password_hash(payload.password)
        user.token_version = int(user.token_version or 0) + 1

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="اسم المستخدم مستخدم بالفعل")
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
def delete_user(user_id: int, response: Response, db: Session = Depends(get_db), current_user: User = Depends(require_manage_users)):
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
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except IntegrityError:
        # Related rows (invoices, appointments, ...) reference this account,
        # so a hard delete is impossible. The honest outcome is a documented
        # deactivation -- surfaced as 200 + body so the client can say
        # "deactivated" instead of pretending the user was erased.
        db.rollback()
        user.is_active = False
        db.commit()
        response.status_code = status.HTTP_200_OK
        return {"deactivated": True, "user_id": user.id}
