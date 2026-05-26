from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

from fastapi import HTTPException
def require_role(user, role):
    if user["role"] != role:
        raise HTTPException(status_code=403, detail="Forbidden")
