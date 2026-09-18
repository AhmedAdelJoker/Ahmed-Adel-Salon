from datetime import timedelta, datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm, HTTPAuthorizationCredentials, HTTPBearer
import pyotp
import jwt
from jwt.exceptions import ExpiredSignatureError, PyJWTError as JWTError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    create_refresh_token,
    decode_token,
    is_jti_revoked,
    revoke_jti,
    token_version_of,
    verify_password,
)
from app.core.rate_limit import rate_limit
from app.core.account_lockout import get_lockout
from app.core.audit import audit_log
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
    request: Request,
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.core.security import verify_password, get_password_hash, validate_password_strength
    from app.services.runtime_settings_service import get_runtime_settings
    from app.api.v1.endpoints.security_settings import DEFAULT_SECURITY_SETTINGS

    if not verify_password(payload.current_password, current_user.hashed_password):
        audit_log(
            db, request, current_user,
            action="change_password_failed",
            entity_type="auth",
            description={"reason": "wrong_current"},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمة المرور الحالية غير صحيحة",
        )
    # Enforce strong passwords if enabled
    sec_settings = get_runtime_settings("security_settings", DEFAULT_SECURITY_SETTINGS)
    if sec_settings.get("enforceStrongPasswords", True):
        try:
            validate_password_strength(payload.new_password)
        except ValueError as e:
            audit_log(
                db, request, current_user,
                action="change_password_failed",
                entity_type="auth",
                description={"reason": "weak_password"},
            )
            raise HTTPException(status_code=400, detail=str(e))
    current_user.hashed_password = get_password_hash(payload.new_password)
    # Phase 3: invalidate every previously issued token (logout everywhere).
    current_user.token_version = token_version_of(current_user) + 1
    db.add(current_user)
    db.commit()
    audit_log(
        db, request, current_user,
        action="change_password",
        entity_type="auth",
        description={"username": current_user.username},
    )
    return {"message": "تم تغيير كلمة المرور بنجاح"}


@router.post("/refresh")
def refresh_token(
    payload: RefreshTokenPayload,
    db: Session = Depends(get_db),
):
    """
    Mint a new access token using a valid refresh token.

    The refresh token must be:
      - Signed with the current SECRET_KEY
      - Not expired (default 7 days)
      - Of type=refresh (rejects access tokens)
    """
    try:
        decoded = decode_token(payload.refresh_token, expected_type="refresh")
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رمز التحديث غير صالح",
        )

    username = decoded.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رمز التحديث لا يحتوي على هوية المستخدم",
        )

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="المستخدم غير موجود أو غير نشط",
        )

    # Phase 3: a rotated/stolen refresh token must not be reusable.
    old_jti = decoded.get("jti")
    if is_jti_revoked(db, old_jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رمز التحديث تم إبطاله. يرجى تسجيل الدخول مرة أخرى.",
        )

    ver = token_version_of(user)
    new_access = create_access_token(subject=user.username, extra_claims={"ver": ver})
    new_refresh = create_refresh_token(subject=user.username, extra_claims={"ver": ver})

    # Refresh rotation: the presented refresh token is single-use.
    try:
        exp_ts = decoded.get("exp")
        exp_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc) if exp_ts else None
    except (TypeError, ValueError, OSError):
        exp_at = None
    revoke_jti(
        db, old_jti, user_id=user.id, token_type="refresh",
        reason="rotation", expires_at=exp_at,
    )
    db.commit()

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


class LogoutPayload(BaseModel):
    refresh_token: str | None = None


@router.post("/logout")
def logout(
    payload: LogoutPayload,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Revoke the current access token (and the given refresh token, if any)."""
    revoked_any = False
    if credentials is not None and credentials.credentials:
        try:
            access_payload = decode_token(credentials.credentials, expected_type="access")
            revoked_any = revoke_jti(
                db, access_payload.get("jti"), user_id=current_user.id,
                token_type="access", reason="logout",
            ) or revoked_any
        except Exception:
            pass
    if payload.refresh_token:
        try:
            refresh_payload = decode_token(payload.refresh_token, expected_type="refresh")
            revoked_any = revoke_jti(
                db, refresh_payload.get("jti"), user_id=current_user.id,
                token_type="refresh", reason="logout",
            ) or revoked_any
        except Exception:
            pass
    db.commit()
    audit_log(
        db, request, current_user,
        action="logout",
        entity_type="auth",
        description={"username": current_user.username},
    )
    return {"message": "تم تسجيل الخروج بنجاح"}


class TwoFactorCode(BaseModel):
    code: str


class TwoFactorDisable(BaseModel):
    password: str


@router.post("/2fa/setup")
def setup_two_factor(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate a TOTP secret (inactive until verified via /2fa/enable)."""
    if getattr(current_user, "totp_enabled", False):
        raise HTTPException(status_code=400, detail="المصادقة الثنائية مفعّلة بالفعل")
    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    current_user.totp_enabled = False
    db.add(current_user)
    db.commit()
    audit_log(
        db, request, current_user,
        action="2fa_setup",
        entity_type="auth",
        description={"username": current_user.username},
    )
    return {
        "secret": secret,
        "otpauth_url": pyotp.totp.TOTP(secret).provisioning_uri(
            name=current_user.username, issuer_name="SalonPro"
        ),
    }


@router.post("/2fa/enable")
def enable_two_factor(
    payload: TwoFactorCode,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Verify a TOTP code against the pending secret and activate 2FA."""
    if getattr(current_user, "totp_enabled", False):
        raise HTTPException(status_code=400, detail="المصادقة الثنائية مفعّلة بالفعل")
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="ابدأ الإعداد أولاً عبر /2fa/setup")
    try:
        ok = bool(
            pyotp.TOTP(current_user.totp_secret).verify(payload.code.strip(), valid_window=1)
        )
    except Exception:
        ok = False
    if not ok:
        raise HTTPException(status_code=400, detail="رمز التحقق غير صحيح")
    current_user.totp_enabled = True
    db.add(current_user)
    db.commit()
    audit_log(
        db, request, current_user,
        action="2fa_enabled",
        entity_type="auth",
        description={"username": current_user.username},
    )
    return {"message": "تم تفعيل المصادقة الثنائية بنجاح"}


@router.post("/2fa/disable")
def disable_two_factor(
    payload: TwoFactorDisable,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Disable 2FA after confirming the account password (recovery path)."""
    if not verify_password(payload.password, current_user.hashed_password):
        audit_log(
            db, request, current_user,
            action="2fa_disable_failed",
            entity_type="auth",
            description={"username": current_user.username, "reason": "wrong_password"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="كلمة المرور غير صحيحة",
        )
    current_user.totp_secret = None
    current_user.totp_enabled = False
    db.add(current_user)
    db.commit()
    audit_log(
        db, request, current_user,
        action="2fa_disabled",
        entity_type="auth",
        description={"username": current_user.username},
    )
    return {"message": "تم إيقاف المصادقة الثنائية"}


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
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    totp_code: str | None = Form(None),
):
    # Phase 3: account lockout by username + IP.
    # The check is per-identifier so a single user can't lock out everyone.
    lockout = get_lockout()
    ip = request.client.host if request.client else "unknown"
    user_identifier = f"user:{form_data.username}"
    ip_identifier = f"ip:{ip}"

    for identifier in (user_identifier, ip_identifier):
        is_locked, retry_after = lockout.is_locked(identifier)
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="تم قفل الحساب مؤقتاً بسبب محاولات فاشلة متكررة. حاول بعد "
                       f"{retry_after} ثانية.",
                headers={"Retry-After": str(retry_after)},
            )

    user = db.query(User).filter(User.username == form_data.username).first()
    if not user:
        # Constant-time-ish dummy verify to avoid leaking whether the user exists
        verify_password(form_data.password, DUMMY_PASSWORD_HASH)
        for identifier in (user_identifier, ip_identifier):
            lockout.record_failure(identifier)
        audit_log(
            db, request, None,
            action="login_failed",
            entity_type="auth",
            description={"username": form_data.username, "reason": "user_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة",
        )

    if not verify_password(form_data.password, user.hashed_password):
        for identifier in (user_identifier, ip_identifier):
            lockout.record_failure(identifier)
        audit_log(
            db, request, user,
            action="login_failed",
            entity_type="auth",
            description={"username": form_data.username, "reason": "wrong_password"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة",
        )

    if not user.is_active:
        audit_log(
            db, request, user,
            action="login_failed",
            entity_type="auth",
            description={"username": form_data.username, "reason": "inactive"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="المستخدم غير نشط",
        )

    # Phase 3 (2FA/TOTP): users with totp_enabled must present a valid code.
    # Machine-readable signal via X-2FA-Required header (detail stays a string).
    if getattr(user, "totp_enabled", False):
        if not totp_code:
            audit_log(
                db, request, user,
                action="login_failed",
                entity_type="auth",
                description={"username": form_data.username, "reason": "totp_missing"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="رمز التحقق مطلوب",
                headers={"X-2FA-Required": "totp"},
            )
        try:
            totp_ok = bool(
                user.totp_secret
                and pyotp.TOTP(user.totp_secret).verify(totp_code.strip(), valid_window=1)
            )
        except Exception:
            totp_ok = False
        if not totp_ok:
            for identifier in (user_identifier, ip_identifier):
                lockout.record_failure(identifier)
            audit_log(
                db, request, user,
                action="login_failed",
                entity_type="auth",
                description={"username": form_data.username, "reason": "totp_invalid"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="رمز التحقق غير صحيح",
                headers={"X-2FA-Required": "totp"},
            )

    # Success: reset failure counters
    for identifier in (user_identifier, ip_identifier):
        lockout.record_success(identifier)
    audit_log(
        db, request, user,
        action="login_success",
        entity_type="auth",
        description={"username": form_data.username},
    )

    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims={"ver": token_version_of(user)},
    )
    refresh_token_value = create_refresh_token(
        subject=user.username, extra_claims={"ver": token_version_of(user)}
    )

    profile_image_url = user.profile_image_url
    if not profile_image_url and user.employee:
        profile_image_url = user.employee.profile_image_url

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_value,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
