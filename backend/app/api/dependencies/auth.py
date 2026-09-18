from fastapi import Header, HTTPException
from jose import jwt

from app.core.config import settings
from app.core.security import ALGORITHM


def get_current_user(token: str = Header(None)):
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        user = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")