from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.schemas.core_business import AuditLogOut
from app.crud.core_business import list_audit_logs

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/", response_model=list[AuditLogOut])
def read_audit_logs(
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_owner),
):
    return list_audit_logs(db, limit=limit)



