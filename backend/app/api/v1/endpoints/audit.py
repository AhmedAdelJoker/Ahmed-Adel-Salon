from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.schemas.core_business import AuditLogOut
from app.crud.core_business import list_audit_logs

router = APIRouter(prefix="/audit", tags=["audit"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[AuditLogOut])
def read_audit_logs(limit: int = 50, db: Session = Depends(get_db)):
    return list_audit_logs(db, limit=limit)



