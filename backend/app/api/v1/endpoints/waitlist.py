from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.waitlist_entry import WaitlistEntry
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.service import Service
from app.models.user import User
from app.schemas.waitlist_entry import (
    WaitlistEntryCreate,
    WaitlistEntryRead,
    WaitlistEntryUpdate,
)
from app.api.deps import require_any_staff

router = APIRouter(prefix="/waitlist", tags=["Waitlist"])


def _waitlist_to_read(db: Session, entry: WaitlistEntry) -> WaitlistEntryRead:
    customer = db.query(Customer).filter(Customer.customer_id == entry.customer_id).first()
    barber = db.query(Employee).filter(Employee.id == entry.barber_id).first() if entry.barber_id else None

    return WaitlistEntryRead(
        id=entry.id,
        customer_id=entry.customer_id,
        barber_id=entry.barber_id,
        preferred_date=entry.preferred_date,
        preferred_time_start=entry.preferred_time_start,
        preferred_time_end=entry.preferred_time_end,
        service_ids=entry.service_ids,
        notes=entry.notes,
        status=entry.status,
        priority=entry.priority,
        notification_sent=entry.notification_sent,
        notification_sent_at=entry.notification_sent_at,
        converted_to_appointment_id=entry.converted_to_appointment_id,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        customer_name=f"{customer.first_name} {customer.last_name}".strip() if customer else "غير معروف",
        customer_phone=customer.phone if customer else None,
        barber_name=barber.display_name if barber else None,
    )


@router.get("", response_model=List[WaitlistEntryRead])
def list_waitlist_entries(
    target_date: Optional[date] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    query = db.query(WaitlistEntry).order_by(
        WaitlistEntry.priority.desc(),
        WaitlistEntry.created_at.asc(),
    )

    if target_date:
        query = query.filter(WaitlistEntry.preferred_date == target_date)

    if status_filter:
        query = query.filter(WaitlistEntry.status == status_filter)
    else:
        query = query.filter(WaitlistEntry.status.in_(["waiting", "notified"]))

    return [_waitlist_to_read(db, entry) for entry in query.all()]


@router.post("", response_model=WaitlistEntryRead, status_code=status.HTTP_201_CREATED)
def create_waitlist_entry(
    payload: WaitlistEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    # Validate customer exists
    customer = db.query(Customer).filter(Customer.customer_id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    # Validate barber if provided
    if payload.barber_id:
        barber = db.query(Employee).filter(Employee.id == payload.barber_id).first()
        if not barber:
            raise HTTPException(status_code=404, detail="الخبير غير موجود")

    # Validate services if provided
    if payload.service_ids:
        for sid in payload.service_ids:
            service = db.query(Service).filter(Service.id == sid).first()
            if not service:
                raise HTTPException(status_code=404, detail=f"الخدمة {sid} غير موجودة")

    import json
    entry = WaitlistEntry(
        customer_id=payload.customer_id,
        barber_id=payload.barber_id,
        preferred_date=payload.preferred_date,
        preferred_time_start=payload.preferred_time_start,
        preferred_time_end=payload.preferred_time_end,
        service_ids=json.dumps(payload.service_ids) if payload.service_ids else None,
        notes=payload.notes,
        priority=payload.priority,
        status="waiting",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return _waitlist_to_read(db, entry)


@router.get("/{entry_id}", response_model=WaitlistEntryRead)
def get_waitlist_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="القيد غير موجود في قائمة الانتظار")
    return _waitlist_to_read(db, entry)


@router.patch("/{entry_id}", response_model=WaitlistEntryRead)
def update_waitlist_entry(
    entry_id: int,
    payload: WaitlistEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="القيد غير موجود في قائمة الانتظار")

    if payload.status is not None:
        entry.status = payload.status
    if payload.priority is not None:
        entry.priority = payload.priority
    if payload.notes is not None:
        entry.notes = payload.notes
    if payload.barber_id is not None:
        entry.barber_id = payload.barber_id

    db.commit()
    db.refresh(entry)

    return _waitlist_to_read(db, entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_waitlist_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="القيد غير موجود في قائمة الانتظار")

    entry.status = "cancelled"
    db.commit()


class ConvertToAppointmentPayload(BaseModel):
    barber_id: int
    appointment_date: date
    appointment_time: str


@router.post("/{entry_id}/convert", response_model=dict)
def convert_waitlist_to_appointment(
    entry_id: int,
    payload: ConvertToAppointmentPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    """Convert a waitlist entry to an actual appointment."""
    entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="القيد غير موجود في قائمة الانتظار")

    if entry.status not in ["waiting", "notified"]:
        raise HTTPException(status_code=400, detail="لا يمكن تحويل هذا القيد")

    # Create the appointment
    from app.api.v1.endpoints.appointments import _create_recurring_instances
    from app.models.appointment import Appointment, AppointmentService
    
    import json
    service_ids = json.loads(entry.service_ids) if entry.service_ids else []

    # Calculate total duration and price
    total_duration = 0
    total_price = 0
    services_to_add = []
    for sid in service_ids:
        service = db.query(Service).filter(Service.id == sid).first()
        if service:
            total_duration += service.duration_minutes or 30
            total_price += float(service.price or 0)
            services_to_add.append(service)

    if total_duration == 0:
        total_duration = 30

    appointment = Appointment(
        customer_id=entry.customer_id,
        barber_id=payload.barber_id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        status="pending",
        notes=entry.notes,
        booking_source="shop",
        total_estimated_price=total_price,
        total_estimated_duration_minutes=total_duration,
        created_by_user_id=getattr(current_user, "id", None),
        updated_by_user_id=getattr(current_user, "id", None),
    )
    db.add(appointment)
    db.flush()

    # Add services
    for service in services_to_add:
        db.add(AppointmentService(
            appointment_id=appointment.id,
            service_id=service.id,
            service_name_snapshot=service.name,
            price_snapshot=service.price,
            duration_snapshot_minutes=service.duration_minutes or 30,
            quantity=1,
            is_active=True,
            is_changed=False,
        ))

    # Update waitlist entry
    entry.status = "booked"
    entry.converted_to_appointment_id = appointment.id

    db.commit()

    return {
        "message": "تم تحويل القيد إلى حجز بنجاح",
        "appointment_id": appointment.id,
    }
