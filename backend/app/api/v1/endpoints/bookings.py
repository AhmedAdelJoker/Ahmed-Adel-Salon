from datetime import datetime
from typing import Optional

from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload

from app.models.customer import Customer
from app.models.employee import Employee

from app.api.deps import require_any_staff
from app.api.v1.endpoints.appointments import _appointment_to_read
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.user import User
from app.schemas.appointment import AppointmentRead

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _bookings_query(db: Session, current_user: User):
    # Eager-load services + customer + barber to fix N+1 (was 2 extra queries per row)
    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.services),
            joinedload(Appointment.customer),
            joinedload(Appointment.barber),
        )
        .order_by(Appointment.id.desc())
    )
    if current_user.role == "barber":
        barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
        if not barber_id:
            return []
        query = query.filter(Appointment.barber_id == barber_id)
    return query.all()


def _appointment_to_read_eager(appointment: Appointment) -> AppointmentRead:
    """N+1-free version that uses already eager-loaded relationships."""
    # Use loaded relationships if present; fallback to FK ids
    customer = getattr(appointment, "customer", None)
    barber = getattr(appointment, "barber", None)
    # If still None due to legacy path, try direct attrs
    if customer is None and hasattr(appointment, "customer_id"):
        # Fallback should not happen when joinedload is used, but keep safe
        customer = None
    if barber is None and hasattr(appointment, "barber_id"):
        barber = None
    return AppointmentRead(
        id=appointment.id,
        customer_id=appointment.customer_id,
        barber_id=appointment.barber_id,
        appointment_date=appointment.appointment_date,
        appointment_time=appointment.appointment_time,
        status=appointment.status,
        notes=appointment.notes,
        booking_source=appointment.booking_source or "shop",
        total_estimated_price=appointment.total_estimated_price,
        total_estimated_duration_minutes=appointment.total_estimated_duration_minutes,
        confirmation_sent=appointment.confirmation_sent,
        reminder_24h_sent=appointment.reminder_24h_sent,
        reminder_2h_sent=appointment.reminder_2h_sent,
        created_at=appointment.created_at,
        updated_at=appointment.updated_at,
        customer_name=(
            f"{customer.first_name or ''} {customer.last_name or ''}".strip()
            if customer and getattr(customer, "first_name", None) is not None
            else "عميل مجهول"
        ),
        customer_phone=getattr(customer, "phone", None) if customer else None,
        barber_name=(
            (getattr(barber, "display_name", None) or getattr(barber, "full_name", None))
            if barber
            else "غير محدد"
        ),
        services=appointment.services or [],
    )


@router.get("", response_model=list[AppointmentRead])
@router.get("/", response_model=list[AppointmentRead], include_in_schema=False)
def list_bookings(
    response: Response = None,
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(200, ge=1, le=500, description="Max records to return"),
    page: Optional[int] = Query(None, ge=1, description="Optional 1-indexed page"),
    page_size: Optional[int] = Query(None, ge=1, le=500, description="Optional page size"),
    sort: Optional[str] = Query(None, description="Sort field. '-' prefix for DESC"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    """Paginated bookings list.

    Phase 2 slice: bounded pagination + X-Total-Count headers + N+1 fix
    (eager-load customer/barber/services). Previously unbounded `.all()`
    with 2 extra queries per row. Default limit 200 preserves backward
    compat for callers without pagination params.
    """
    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.services),
            joinedload(Appointment.customer),
            joinedload(Appointment.barber),
        )
    )

    # Explicit sort handling (defaults to id desc for stable pagination)
    if sort:
        sort_field = sort.lstrip("-")
        desc = sort.startswith("-")
        column = getattr(Appointment, sort_field, None)
        if column is not None:
            query = query.order_by(column.desc() if desc else column.asc())
        else:
            query = query.order_by(Appointment.id.desc())
    else:
        query = query.order_by(Appointment.id.desc())

    if current_user.role == "barber":
        barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
        if not barber_id:
            if response is not None:
                response.headers["X-Total-Count"] = "0"
            return []
        query = query.filter(Appointment.barber_id == barber_id)

    # Normalize page/page_size -> skip/limit
    eff_skip = skip
    eff_limit = limit
    if page is not None and page_size is not None:
        eff_skip = (page - 1) * page_size
        eff_limit = page_size

    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)

    rows = query.offset(eff_skip).limit(eff_limit).all()
    # Use eager relationships — no per-row DB hits
    return [_appointment_to_read_eager(row) for row in rows]


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



