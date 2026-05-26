from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime
from typing import Any, List

from app.api import deps
from app.models.invoice import Invoice
from app.models.employee import Employee
from app.models.appointment import Appointment
# Assuming we will map these new tables in SQLAlchemy as well or use raw SQL via Prisma for now
# For this execution, we'll use a mix of existing models and logic

router = APIRouter()

@router.get("/stats")
def get_barber_stats(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    period: str = "today" # today, week, month
) -> Any:
    """
    Get detailed financial and performance stats for the barber.
    """
    if current_user.role != "barber" and current_user.role not in ["admin", "owner", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get barber profile
    # Note: Using SQLAlchemy for existing models
    barber = db.query(Barber).filter(Barber.id == current_user.barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barber profile not found")

    today = date.today()
    # Simple logic for now, can be expanded with real date filters

    # 1. Total Services Count
    service_count = db.query(func.count(Appointment.id)).filter(
        Appointment.barber_id == barber.id,
        Appointment.status == "completed",
        func.date(Appointment.start_at) == today
    ).scalar() or 0
    # 2. Commissions (Calculated from Invoices linked to this barber)
    # We'll use a mock calculation based on subtotal for demonstration
    total_sales = db.query(func.sum(Invoice.subtotal_amount)).filter(
        Invoice.barber_id == barber.id,
        func.date(Invoice.created_at) == today
    ).scalar() or 0
    
    commission_rate = 0.15 # 15%
    total_commission = float(total_sales) * commission_rate
    
    # 3. Advances (Mock value for now)
    total_advances = 150.0 # Mock: سلف مستلمة
    
    return {
        "services_today": service_count,
        "total_customers": service_count, # Distinct customers
        "commission_rate": "15%",
        "earned_commission": total_commission,
        "received_advances": total_advances,
        "net_due": total_commission - total_advances,
        "commitment": {
            "absence_days": 1,
            "late_hours": 2.5
        }
    }

@router.get("/queue")
def get_barber_queue(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get the barber's specific queue (waiting and completed).
    """
    barber = db.query(Barber).filter(Barber.id == current_user.barber_id).first()
    if not barber:
        return {"waiting": [], "completed": []}

    today = date.today()

    waiting = db.query(Appointment).filter(
        Appointment.barber_id == barber.id,
        Appointment.status.in_(["waiting", "in-service"]),
        func.date(Appointment.start_at) == today
    ).all()

    completed = db.query(Appointment).filter(
        Appointment.barber_id == barber.id,
        Appointment.status == "completed",
        func.date(Appointment.start_at) == today
    ).all()
    return {
        "waiting": waiting,
        "completed": completed
    }

@router.post("/update-status/{appointment_id}")
def update_service_status(
    appointment_id: int,
    status: str, # in-service, completed
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment.status = status
    if status == "completed":
        appointment.end_at = datetime.now()
    
    db.add(appointment)
    db.commit()
    return {"status": "success"}



