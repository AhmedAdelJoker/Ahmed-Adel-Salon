from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.schemas.core_business import DashboardCoreSummary
from app.crud.core_business import get_dashboard_core_summary

router = APIRouter(prefix="/dashboard-core", tags=["dashboard-core"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/summary", response_model=DashboardCoreSummary)
def dashboard_core_summary(db: Session = Depends(get_db)):
    return get_dashboard_core_summary(db)



