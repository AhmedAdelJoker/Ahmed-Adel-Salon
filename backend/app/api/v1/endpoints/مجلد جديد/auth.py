from fastapi.middleware.cors import CORSMiddleware
from datetime import timedelta
from typing import Optional

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from jose import JWTError

from app.db.session import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.api.deps_auth import get_current_active_user, oauth2_scheme

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["Authentication"])


class RefreshTokenRequest(BaseModel):
    refresh_token: str


def _session_payload_from_token(token: str, current_user: User, request: Request) -> dict:
    decoded = decode_token(token)
    expires_at = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
    issued_at = expires_at - timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    user_agent = request.headers.get("user-agent", "")
    return {
        "id": f"access-{current_user.id}",
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "is_current": True,
        "device_label": user_agent[:255] or "Current Browser Session",
        "ip_address": request.client.host if request.client else None,
        "created_at": issued_at.isoformat(),
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
    }


@router.get("/me")
def get_current_user_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.employee import Employee
    employee = db.query(Employee).filter(Employee.id == current_user.employee_id).first()
    
    barber_id = None
    if employee and employee.job_title == "barber":
        barber_id = employee.id

    return {
        "id": current_user.id,
        "username": current_user.username,
        "fullName": current_user.full_name,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "employee_id": current_user.employee_id,
        "barber_id": barber_id,
        "profile_image_url": current_user.profile_image_url,
        "is_active": current_user.is_active,
    }


@router.get("/sessions")
def get_active_sessions(
    request: Request,
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_active_user),
):
    return [_session_payload_from_token(token, current_user, request)]


@router.post("/login")
@limiter.limit("5/minute")
def login(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="المستخدم غير نشط",
        )

    from app.models.employee import Employee
    employee = db.query(Employee).filter(Employee.id == user.employee_id).first()
    
    barber_id = None
    if employee and employee.job_title == "barber":
        barber_id = employee.id

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": user.role,
        "employee_id": user.employee_id,
        "barber_id": barber_id,
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "employee_id": user.employee_id,
            "barber_id": barber_id,
            "profile_image_url": user.profile_image_url,
            "is_active": user.is_active,
        },
    }


@router.post("/refresh")
def refresh_access_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = decoded.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate refresh token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    new_access_token = create_access_token(subject=user.id)
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }



