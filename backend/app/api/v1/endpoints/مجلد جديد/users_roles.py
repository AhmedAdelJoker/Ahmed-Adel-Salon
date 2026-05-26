from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.employee import Employee
from app.models.user import User
from app.schemas.user_role import UserActiveUpdate, UserCreate, UserRead, UserRoleUpdate

router = APIRouter(prefix="/users", tags=["Users Roles Management"])

ALLOWED_ROLES = {"owner", "manager", "cashier", "barber", "employee"}


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    return db.query(User).order_by(User.id.desc()).all()


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    if payload.role == "barber" and payload.employee_id is None:
        raise HTTPException(status_code=400, detail="employee_id is required for barber role")

    if payload.employee_id is not None:
        employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

    user = User(
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        employee_id=payload.employee_id,
        is_active=payload.is_active,
        permissions=payload.permissions or {},
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    db.refresh(user)
    return user


from app.services.activity_service import log_activity

@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserCreate, # Reusing UserCreate for full update, but password is optional
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    old_values = {
        "full_name": user.full_name,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active
    }

    user.full_name = payload.full_name
    user.username = payload.username
    user.role = payload.role
    user.is_active = payload.is_active
    user.email = payload.email
    user.permissions = payload.permissions
    
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)
    
    if payload.employee_id:
        user.employee_id = payload.employee_id
        # Also update employee display name if linked
        employee = db.query(Employee).filter(Employee.id == user.employee_id).first()
        if employee:
            employee.display_name = payload.full_name

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    
    db.refresh(user)

    log_activity(
        db,
        user_id=current_user.id,
        action="update_user_full",
        entity_type="user",
        entity_id=user.id,
        description=f"Full update for user: {user.username}",
        old_values=old_values,
        new_values={
            "full_name": user.full_name,
            "username": user.username,
            "role": user.role,
            "is_active": user.is_active
        }
    )

    return user


@router.patch("/{user_id}/role", response_model=UserRead)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    if payload.role == "barber" and payload.employee_id is None:
        raise HTTPException(status_code=400, detail="employee_id is required for barber role")

    if payload.employee_id is not None:
        employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

    old_values = {"role": user.role, "employee_id": user.employee_id}

    user.role = payload.role
    user.employee_id = payload.employee_id
    db.commit()
    db.refresh(user)

    new_values = {"role": user.role, "employee_id": user.employee_id}
    log_activity(
        db,
        user_id=current_user.id,
        action="update_user_role",
        entity_type="user",
        entity_id=user.id,
        description=f"Updated role for user: {user.username} to {user.role}",
        old_values=old_values,
        new_values=new_values
    )

    return user


@router.patch("/{user_id}/active", response_model=UserRead)
def update_user_active(
    user_id: int,
    payload: UserActiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_values = {"is_active": user.is_active}
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    new_values = {"is_active": user.is_active}
    log_activity(
        db,
        user_id=current_user.id,
        action="update_user_active",
        entity_type="user",
        entity_id=user.id,
        description=f"Updated active status for user: {user.username} to {user.is_active}",
        old_values=old_values,
        new_values=new_values
    )

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    log_activity(
        db,
        user_id=current_user.id,
        action="delete_user",
        entity_type="user",
        entity_id=user.id,
        description=f"Deleted user: {user.username}",
        old_values={"username": user.username, "role": user.role}
    )

    db.delete(user)
    db.commit()
    return None



