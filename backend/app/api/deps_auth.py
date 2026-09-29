from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import PyJWTError as JWTError
from sqlalchemy.orm import Session

from app.core.roles import normalize_role
from app.core.security import decode_token, is_jti_revoked, token_version_of
from app.core.totp_enforcement import ENROLLMENT_SCOPE
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

    # An enrolment-only token is a valid, correctly signed, unexpired token that
    # must not open anything. Rejecting it here rather than in each endpoint is
    # the point: the scope is checked once, in the single place every staff route
    # passes through, so a new endpoint added later is covered by default instead
    # of needing to remember.
    #
    # This is the difference between "2FA is required" and "2FA is requested".
    # A check placed in the frontend, or in a list of endpoints that remember to
    # call it, is bypassed by the next endpoint somebody adds.
    if payload.get("scope") == ENROLLMENT_SCOPE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finish setting up two-factor authentication to continue.",
            headers={
                "X-2FA-Enrollment-Required": "true",
                "WWW-Authenticate": "Bearer",
            },
        )

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


def get_current_enrollment_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """The one dependency that accepts an enrolment-only token.

    Deliberately *only* that token, so an attacker holding a stolen `owner`
    password cannot use the enrolment endpoints to reach anything -- but the
    legitimate owner, whose grace period expired, can still finish setup and get
    back in.
    """
    try:
        payload = decode_token(token, expected_type="access")
    except JWTError:
        raise _credentials_exception()

    if payload.get("scope") != ENROLLMENT_SCOPE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available during two-factor setup.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    if not username:
        raise _credentials_exception()
    if is_jti_revoked(db, payload.get("jti")):
        raise _credentials_exception()

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise _credentials_exception()
    return user


def get_current_user_or_enrolling(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Accepts a full session *or* an enrolment-only token.

    For `/2fa/setup` and `/2fa/enable` only. Both flows must reach these two
    endpoints: a privileged user enrolling early has a normal session, and the
    same user blocked by an expired grace period has the restricted one. Refusing
    either would make one of those two paths impossible.

    The security of this rests on `authenticate_access_token` rejecting the
    restricted scope everywhere else -- one check, in the single choke point
    every other route passes through. It is why these two endpoints are the only
    ones that bypass the normal dependency: a wider exception here would be a
    hole with a very small hole in it.
    """
    try:
        payload = decode_token(token, expected_type="access")
    except JWTError:
        raise _credentials_exception()

    if payload.get("scope") != ENROLLMENT_SCOPE:
        # Not restricted, so the normal path applies, scope rejection included.
        return authenticate_access_token(db, token)

    username = payload.get("sub")
    if not username:
        raise _credentials_exception()
    if is_jti_revoked(db, payload.get("jti")):
        raise _credentials_exception()

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise _credentials_exception()
    return user
