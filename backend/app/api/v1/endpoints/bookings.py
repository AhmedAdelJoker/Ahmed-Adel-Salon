from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_any_staff
from app.api.v1.endpoints.appointments import _appointment_to_read
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.user import User
from app.schemas.appointment import AppointmentRead

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _bookings_query(db: Session, current_user: User):
    query = (
        db.query(Appointment)
        .options(joinedload(Appointment.services))
        .order_by(Appointment.id.desc())
    )
    if current_user.role == "barber":
        barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
        if not barber_id:
            return []
        query = query.filter(Appointment.barber_id == barber_id)
    return query.all()


@router.get("", response_model=list[AppointmentRead])
@router.get("/", response_model=list[AppointmentRead], include_in_schema=False)
def list_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    return [_appointment_to_read(db, row) for row in _bookings_query(db, current_user)]


@router.get("/customer/{customer_id}/active", response_model=list[AppointmentRead])
def get_customer_active_bookings(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    bookings = (
        db.query(Appointment)
        .options(joinedload(Appointment.services))
        .filter(
            Appointment.customer_id == customer_id,
            Appointment.status.in_(["pending", "confirmed", "in_progress"])
        )
        .order_by(Appointment.appointment_date.desc(), Appointment.appointment_time.desc())
        .all()
    )
    return [_appointment_to_read(db, b) for b in bookings]


@router.get("/{booking_id}", response_model=AppointmentRead)
@router.get("/{booking_id}/", response_model=AppointmentRead, include_in_schema=False)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    booking = (
        db.query(Appointment)
        .options(joinedload(Appointment.services))
        .filter(Appointment.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    
    barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
    if current_user.role == "barber" and barber_id != booking.barber_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذا الحجز")
    return _appointment_to_read(db, booking)



