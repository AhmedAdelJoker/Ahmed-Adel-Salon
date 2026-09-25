from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import PyJWTError as JWTError
from sqlalchemy.orm import Session

from app.core.roles import normalize_role
from app.core.security import decode_token, is_jti_revoked, token_version_of
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="تعذر التحقق من بيانات الدخول",
        headers={"WWW-Authenticate": "Bearer"},
    )


def authenticate_access_token(db: Session, token: str) -> User:
    try:
        payload = decode_token(token, expected_type="access")
    except JWTError:
        raise _credentials_exception()

    username = payload.get("sub")
    if not username:
        raise _credentials_exception()
    if is_jti_revoked(db, payload.get("jti")):
        raise _credentials_exception()

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise _credentials_exception()

    try:
        token_version = int(payload.get("ver", 0) or 0)
    except (TypeError, ValueError):
        token_version = 0
    if token_version != token_version_of(user):
        raise _credentials_exception()

    user.role = normalize_role(user.role)
    return user


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    return authenticate_access_token(db, token)


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="المستخدم غير نشط",
        )
    return current_user
