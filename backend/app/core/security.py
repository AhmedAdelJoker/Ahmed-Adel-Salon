from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt.exceptions import PyJWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DUMMY_PASSWORD_HASH = pwd_context.hash("SalonProDummyPassword123!")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def validate_password_strength(password: str) -> str:
    errors = []

    if len(password) < 8:
        errors.append("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    if password.lower() == password:
        errors.append("كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل")
    if password.upper() == password:
        errors.append("كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل")
    if not any(char.isdigit() for char in password):
        errors.append("كلمة المرور يجب أن تحتوي على رقم واحد على الأقل")

    if errors:
        raise ValueError("، ".join(errors))

    return password


def _encode_token(
    subject: str,
    token_type: str,
    expires_minutes: int,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Internal helper — encode a JWT with consistent claims."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes)
    to_encode: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": now,
        "nbf": now,
        "type": token_type,
        "jti": __import__("uuid").uuid4().hex,  # unique id — used for revocation
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Short-lived access token (1 hour by default after Phase 3)."""
    minutes = (
        int(expires_delta.total_seconds() // 60)
        if expires_delta
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return _encode_token(subject, "access", minutes, extra_claims)


def create_refresh_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Long-lived refresh token (7 days) — used only to mint new access tokens."""
    return _encode_token(
        subject, "refresh", settings.REFRESH_TOKEN_EXPIRE_MINUTES, extra_claims
    )


def decode_token(token: str, expected_type: str = "access") -> dict[str, Any]:
    """Decode and validate a JWT. Raises on expired/invalid/wrong-type tokens."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise PyJWTError(f"Invalid token type: expected '{expected_type}'")
    return payload


# ----------------------------------------------------------------------------
# Token revocation (denylist) — Phase 3
# ----------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def revoke_jti(
    db: Session,
    jti: str | None,
    *,
    user_id: int | None = None,
    token_type: str = "access",
    reason: str = "logout",
    expires_at: datetime | None = None,
) -> bool:
    """Add a JWT id to the denylist. Returns False when there is nothing to revoke."""
    if not jti:
        return False
    from app.models.revoked_token import RevokedToken

    # Opportunistic purge of long-expired rows (keeps the table tiny).
    try:
        db.query(RevokedToken).filter(
            RevokedToken.expires_at.isnot(None),
            RevokedToken.expires_at < _utcnow(),
        ).delete(synchronize_session=False)
    except Exception:
        pass
    if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        return True
    db.add(
        RevokedToken(
            jti=jti,
            user_id=user_id,
            token_type=token_type,
            reason=reason[:64] if reason else "logout",
            expires_at=expires_at,
        )
    )
    db.flush()
    return True


def is_jti_revoked(db: Session, jti: str | None) -> bool:
    """True when the token id is denylisted. Fail-closed on missing jti."""
    if not jti:
        return True
    from app.models.revoked_token import RevokedToken

    return (
        db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None
    )


def token_version_of(user: Any) -> int:
    """Token generation of a user (0 for rows created before Phase 3)."""
    try:
        return int(getattr(user, "token_version", 0) or 0)
    except (TypeError, ValueError):
        return 0
