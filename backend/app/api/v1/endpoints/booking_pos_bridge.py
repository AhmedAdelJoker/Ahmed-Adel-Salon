from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_cashier_manager_owner
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.invoice import Invoice
from app.models.invoice_payment import InvoicePayment
from app.models.user import User

router = APIRouter()
STATUS_READY = ["ready_for_payment", "ready_for_pos"]


class MarkPaidPayload(BaseModel):
    invoice_id: Optional[int] = None
    invoiceId: Optional[int] = None


def _employee_id(current_user: User) -> Optional[int]:
    return current_user.barber_id or current_user.employee_id


def _get_booking(db: Session, booking_id: int, current_user: User) -> Appointment:
    appointment = db.query(Appointment).filter(Appointment.id == booking_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    if current_user.role == "barber" and _employee_id(current_user) != appointment.barber_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذا الحجز")
    return appointment


@router.get("/bookings/ready-for-pos")
def ready_for_pos_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
) -> List[Dict[str, Any]]:
    invoiced_ids = db.query(Invoice.appointment_id).filter(
        Invoice.appointment_id.isnot(None)
    )
    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.customer),
            joinedload(Appointment.barber),
            joinedload(Appointment.services),
        )
        .filter(
            Appointment.status.in_(STATUS_READY),
            Appointment.id.notin_(invoiced_ids),
        )
    )
    if current_user.role == "barber":
        query = query.filter(Appointment.barber_id == _employee_id(current_user))

    result = []
    for appointment in query.order_by(Appointment.id.desc()).all():
        service = appointment.services[0] if appointment.services else None
        result.append(
            {
                "id": appointment.id,
                "customer_id": appointment.customer_id,
                "customer_name": (
                    f"{appointment.customer.first_name} {appointment.customer.last_name}"
                    if appointment.customer
                    else "Unknown"
                ),
                "service_id": service.service_id if service else None,
                "service_name": service.service_name_snapshot if service else "",
                "employee_id": appointment.barber_id,
                "employee_name": (
                    appointment.barber.display_name if appointment.barber else "Unknown"
                ),
                "amount": float(appointment.total_estimated_price or 0),
                "booking_time": (
                    f"{appointment.appointment_date} {appointment.appointment_time}"
                ),
                "status": appointment.status,
            }
        )
    return result


@router.post("/bookings/{booking_id}/start-service")
def start_service(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
) -> Dict[str, Any]:
    appointment = _get_booking(db, booking_id, current_user)
    if appointment.status not in {"pending", "confirmed", "waiting", "in_service"}:
        raise HTTPException(status_code=409, detail="الحجز لا يمكن بدء خدمته في الحالة الحالية")
    appointment.status = "in-service"
    db.commit()
    return {"status": "success"}


@router.post("/bookings/{booking_id}/complete-service")
def complete_service(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
) -> Dict[str, Any]:
    appointment = _get_booking(db, booking_id, current_user)
    if appointment.status not in {"in-service", "in_service"}:
        raise HTTPException(status_code=409, detail="يجب بدء الخدمة قبل إكمالها")
    appointment.status = "ready_for_payment"
    db.commit()
    return {"status": "success"}


@router.post("/bookings/{booking_id}/mark-paid")
def mark_paid(
    booking_id: int,
    payload: MarkPaidPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
) -> Dict[str, Any]:
    appointment = _get_booking(db, booking_id, current_user)
    invoice_id = payload.invoice_id if payload.invoice_id is not None else payload.invoiceId
    if not invoice_id:
        raise HTTPException(status_code=400, detail="invoice_id مطلوب")

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice or invoice.appointment_id != booking_id or invoice.is_draft:
        raise HTTPException(status_code=409, detail="الفاتورة غير مرتبطة بالحجز")
    paid_amount = (
        db.query(InvoicePayment)
        .filter(InvoicePayment.invoice_id == invoice.id)
        .with_entities(InvoicePayment.amount)
        .all()
    )
    if not paid_amount or sum((row.amount for row in paid_amount), 0) < invoice.total_amount:
        raise HTTPException(status_code=409, detail="الفاتورة غير مسجلة كمدفوعة")

    appointment.status = "completed"
    db.commit()
    return {"status": "success", "invoice_id": invoice.id}
