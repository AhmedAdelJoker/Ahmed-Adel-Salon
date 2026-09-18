from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import PyJWTError as JWTError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import ALGORITHM, is_jti_revoked, token_version_of
from app.core.roles import normalize_role
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="تعذر التحقق من بيانات الدخول",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        token_type = payload.get("type", "access")
        if username is None:
            raise credentials_exception
        if token_type != "access":
            raise credentials_exception
        # Phase 3: reject denylisted tokens (logout / rotated refresh).
        if is_jti_revoked(db, payload.get("jti")):
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    # Phase 3: reject tokens issued before the last password change.
    try:
        token_ver = int(payload.get("ver", 0) or 0)
    except (TypeError, ValueError):
        token_ver = 0
    if token_ver != token_version_of(user):
        raise credentials_exception

    user.role = normalize_role(user.role)

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="المستخدم غير نشط",
        )
    return current_user
