from datetime import timedelta, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm, HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    verify_password,
)
from app.core.rate_limit import rate_limit
from app.models.user import User

from app.api.deps_auth import get_current_active_user, oauth2_scheme
from app.schemas.profile import ProfileRead

router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer(auto_error=False)


@router.get("/me", response_model=ProfileRead)
def get_me(current_user: User = Depends(get_current_active_user)):
    """
    الحصول على بيانات المستخدم الحالي
    """
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


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class RefreshTokenPayload(BaseModel):
    refresh_token: str


@router.post("/change-password")
def change_password(
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.core.security import verify_password, get_password_hash
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمة المرور الحالية غير صحيحة",
        )
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()
    return {"message": "تم تغيير كلمة المرور بنجاح"}


@router.post("/refresh")
def refresh_token(payload: RefreshTokenPayload):
    """
    تجديد توكن الوصول (Stub)
    """
    # NOTE: In a real implementation, you would verify the refresh token
    # and issue a new access token. For now, we return 401 to force re-login
    # or implement basic logic if needed.
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token refresh not fully implemented",
    )


@router.get("/sessions")
def get_active_sessions(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: User = Depends(get_current_active_user),
):
    """
    الحصول على جلسات تسجيل الدخول النشطة للمستخدم الحالي
    """
    issued_at = datetime.now(timezone.utc) - timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    user_agent = request.headers.get("user-agent", "")
    return [
        {
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
    ]


@router.post(
    "/login",
    dependencies=[
        Depends(
            rate_limit(
                "auth_login",
                max_requests=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
                window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):

    user = db.query(User).filter(User.username == form_data.username).first()
    if not user:
        verify_password(form_data.password, DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة",
        )

    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="المستخدم غير نشط",
        )

    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    profile_image_url = user.profile_image_url
    if not profile_image_url and user.employee:
        profile_image_url = user.employee.profile_image_url

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "barber_id": user.employee_id,
            "is_active": user.is_active,
            "profile_image_url": profile_image_url,
            "display_name": user.display_name,
            "bio_ar": user.bio_ar
        },
    }
