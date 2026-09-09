from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.schemas.core_business import DashboardCoreSummary
from app.crud.core_business import get_dashboard_core_summary

router = APIRouter(prefix="/dashboard-core", tags=["dashboard-core"])


@router.get("/summary", response_model=DashboardCoreSummary)
def dashboard_core_summary(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner),
):
    return get_dashboard_core_summary(db)



