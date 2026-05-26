from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

from fastapi import Header, HTTPException
from jose import jwt
SECRET = "SUPER_SECRET_KEY"
def get_current_user(token: str = Header(None)):
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        user = jwt.decode(token, SECRET, algorithms=["HS256"])
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")