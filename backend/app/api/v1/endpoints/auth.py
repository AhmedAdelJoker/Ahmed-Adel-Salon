from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
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

from app.api.deps_auth import get_current_active_user
from app.schemas.profile import ProfileRead

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me", response_model=ProfileRead)
def get_me(current_user: User = Depends(get_current_active_user)):
    """
    الحصول على بيانات المستخدم الحالي
    """
    return current_user


class RefreshTokenPayload(BaseModel):
    refresh_token: str

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

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "barber_id": user.barber_id,
            "is_active": user.is_active,
        },
    }
