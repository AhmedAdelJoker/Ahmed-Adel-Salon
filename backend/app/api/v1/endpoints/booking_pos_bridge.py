from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.employee import Employee
from app.api.deps import get_current_active_user

router = APIRouter()

# Unified statuses
STATUS_READY = ["completed", "ready_for_payment", "ready_for_pos"]
STATUS_PAID = ["paid", "invoiced", "closed", "done"]


class MarkPaidPayload(BaseModel):
    invoice_id: Optional[int] = None
    invoiceId: Optional[int] = None


@router.get("/bookings/ready-for-pos")
def ready_for_pos_bookings(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
) -> List[Dict[str, Any]]:
    """
    Get appointments that are ready to be paid for in the POS.
    """
    appointments = db.query(Appointment).options(
        joinedload(Appointment.customer),
        joinedload(Appointment.barber),
        joinedload(Appointment.services)
    ).filter(
        Appointment.status.in_(STATUS_READY)
    ).order_by(Appointment.id.desc()).all()

    result = []
    for appt in appointments:
        # Get first service name if available
        service_name = appt.services[0].service_name_snapshot if appt.services else ""
        service_id = appt.services[0].service_id if appt.services else None
        
        result.append({
            "id": appt.id,
            "customer_id": appt.customer_id,
            "customer_name": f"{appt.customer.first_name} {appt.customer.last_name}" if appt.customer else "Unknown",
            "service_id": service_id,
            "service_name": service_name,
            "employee_id": appt.barber_id,
            "employee_name": appt.barber.display_name if appt.barber else "Unknown",
            "amount": float(appt.total_estimated_price),
            "booking_time": f"{appt.appointment_date} {appt.appointment_time}",
            "status": appt.status
        })
    
    return result


@router.post("/bookings/{booking_id}/start-service")
def start_service(
    booking_id: int, 
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
) -> Dict[str, Any]:
    appt = db.query(Appointment).filter(Appointment.id == booking_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    
    appt.status = "in-service"
    db.commit()
    return {"status": "success"}


@router.post("/bookings/{booking_id}/complete-service")
def complete_service(
    booking_id: int, 
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
) -> Dict[str, Any]:
    appt = db.query(Appointment).filter(Appointment.id == booking_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    
    appt.status = "ready_for_payment"
    db.commit()
    return {"status": "success"}


@router.post("/bookings/{booking_id}/mark-paid")
def mark_paid(
    booking_id: int, 
    payload: MarkPaidPayload, 
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
) -> Dict[str, Any]:
    appt = db.query(Appointment).filter(Appointment.id == booking_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    
    invoice_id = payload.invoice_id if payload.invoice_id is not None else payload.invoiceId
    
    appt.status = "completed"
    appt.session_id = invoice_id # Reusing session_id to store invoice reference if needed
    db.commit()
    return {"status": "success"}
