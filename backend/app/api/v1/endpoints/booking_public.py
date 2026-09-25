import asyncio
import json
import logging
import threading
import time
from collections import deque
from decimal import Decimal
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.endpoints.member_public import get_optional_member
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.service import Service
from app.models.service_category import ServiceCategory
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.business_settings import BusinessSettings
from app.models.employee_working_hour import EmployeeWorkingHour
from app.models.employee_time_off import EmployeeTimeOff
from app.models.notification import Notification

from app.schemas.booking import PublicBookingCreate, PublicBookingResponse
from app.core.config import settings
from app.core.rate_limit import rate_limit
from app.services import booking_scheduler
from app.services.meta_whatsapp_service import send_booking_confirmation_template

router = APIRouter(prefix="/public", tags=["Public Booking"])
logger = logging.getLogger(__name__)
_events: dict[str, deque] = {}
_event_sequences: dict[str, int] = {}
_events_lock = threading.Lock()


def _event_key(slug: str) -> str:
    return slug.strip().lower() or "default"


def publish_booking_event(slug: str, event_type: str, data: dict) -> None:
    key = _event_key(slug)
    with _events_lock:
        sequence = _event_sequences.get(key, 0) + 1
        _event_sequences[key] = sequence
        bucket = _events.setdefault(key, deque(maxlen=100))
        bucket.append(
            {
                "sequence": sequence,
                "event": {
                    "type": event_type,
                    "timestamp": time.time(),
                    "data": data,
                },
            }
        )


def _events_after(slug: str, sequence: int) -> list[dict]:
    key = _event_key(slug)
    with _events_lock:
        return [item for item in _events.get(key, ()) if item["sequence"] > sequence]


def _latest_sequence(slug: str) -> int:
    key = _event_key(slug)
    with _events_lock:
        return _event_sequences.get(key, 0)


def _get_or_create_customer(
    db: Session,
    payload: PublicBookingCreate,
    member: Customer | None = None,
) -> Customer:
    if member is not None:
        if payload.email:
            member.email = payload.email
        member.phone = payload.phone
        db.add(member)
        db.flush()
        return member

    customer = db.query(Customer).filter(Customer.phone == payload.phone).first()
    last_name = payload.last_name or ""

    if customer:
        customer.first_name = payload.first_name
        customer.last_name = last_name
        customer.email = payload.email
        db.add(customer)
        db.flush()
        return customer

    customer = Customer(
        first_name=payload.first_name,
        last_name=last_name,
        phone=payload.phone,
        email=payload.email,
    )
    db.add(customer)
    db.flush()
    return customer


def _rebuild_appointment_services_public(
    db: Session,
    appointment: Appointment,
    items: list,
) -> None:
    db.query(AppointmentService).filter(
        AppointmentService.appointment_id == appointment.id
    ).delete()

    total_price = Decimal("0.00")
    total_duration = 0
    rows = []

    for item in items:
        service = (
            db.query(Service)
            .filter(Service.id == item.service_id, Service.is_active == True)
            .first()
        )
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"الخدمة {item.service_id} غير موجودة",
            )

        qty = item.quantity or 1
        price = Decimal(str(service.price or 0))
        duration = int(getattr(service, "duration_minutes", 30) or 30)

        total_price += price * qty
        total_duration += duration * qty

        rows.append(
            AppointmentService(
                appointment_id=appointment.id,
                service_id=service.id,
                service_name_snapshot=service.name,
                price_snapshot=price,
                duration_snapshot_minutes=duration,
                quantity=qty,
                is_active=True,
                is_changed=False,
            )
        )

    db.add_all(rows)
    appointment.total_estimated_price = total_price
    appointment.total_estimated_duration_minutes = total_duration


from app.models.offer import Offer

@router.get(
    "/booking-catalog",
    dependencies=[
        Depends(
            rate_limit(
                "public_booking_catalog",
                max_requests=settings.PUBLIC_RATE_LIMIT_MAX_REQUESTS,
                window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
def get_booking_catalog(
    db: Session = Depends(get_db),
):
    settings_row = db.query(BusinessSettings).first()
    services = (
        db.query(Service)
        .filter(Service.is_active == True)
        .order_by(Service.id.asc())
        .all()
    )
    barbers = (
        db.query(Employee)
        .filter(Employee.is_active == True, Employee.show_in_booking == True)
        .order_by(Employee.id.asc())
        .all()
    )
    try:
        categories = (
            db.query(ServiceCategory)
            .filter(ServiceCategory.is_active == True)
            .order_by(ServiceCategory.sort_order.asc())
            .all()
        )
    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        categories = []
    
    # NEW: Fetch Public Offers/Bundles
    try:
        offers = (
            db.query(Offer)
            .filter(Offer.is_active == True)
            .filter(Offer.is_public == True)
            .order_by(Offer.id.desc())
            .all()
        )
    except Exception as e:
        logger.error(f"Error fetching offers: {e}")
        offers = []

    return {
        "business": {
            "salon_name": settings_row.salon_name if settings_row else "SalonPro",
            "shop_phone": settings_row.shop_phone if settings_row else None,
            "shop_whatsapp": settings_row.shop_whatsapp if settings_row else None,
            "address": settings_row.address if settings_row else None,
            "logo_url": settings_row.logo_url if settings_row else None,
            "working_hours": settings_row.working_hours if settings_row else None,
        },
        "services": [
            {
                "id": s.id,
                "name": s.name,
                "name_ar": s.name_ar,
                "price": float(s.price or 0),
                "duration_minutes": int(getattr(s, "duration_minutes", 30) or 30),
                "description_ar": getattr(s, "description_ar", ""),
                "image_url": getattr(s, "image_url", None),
                "category_id": getattr(s, "category_id", None),
            }
            for s in services
        ],
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "name_ar": c.name_ar,
                "icon": c.icon,
            }
            for c in categories
        ],
        "barbers": [
            {
                "id": b.id,
                "display_name": b.display_name or b.full_name,
                "job_title": b.job_title,
                "profile_image_url": b.profile_image_url,
                "bio_ar": getattr(b, "bio_ar", ""),
            }
            for b in barbers
        ],
        "offers": [
            {
                "id": o.id,
                "name": o.name,
                "name_ar": o.name_ar,
                "description_ar": o.description_ar,
                "offer_price": float(o.offer_price or 0),
                "original_price": float(o.original_price or 0),
                "discount_percentage": float(o.discount_percentage or 0),
                "image_url": o.image_url,
            }
            for o in offers
        ]
    }


@router.get(
    "/time-slots",
    dependencies=[
        Depends(
            rate_limit(
                "public_time_slots",
                max_requests=settings.PUBLIC_RATE_LIMIT_MAX_REQUESTS,
                window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
def get_time_slots(
    barber_id: Optional[int] = Query(None),
    booking_date: date = Query(...),
    service_ids: List[int] = Query(default=[], alias="service_ids[]"),
    db: Session = Depends(get_db),
):
    if barber_id:
        barbers = db.query(Employee).filter(Employee.id == barber_id).all()
        if not barbers:
            raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    else:
        barbers = (
            db.query(Employee)
            .filter(Employee.is_active == True, Employee.show_in_booking == True)
            .all()
        )

    # احسب مدة الخدمات المختارة
    total_duration = 30
    if service_ids:
        services = db.query(Service).filter(Service.id.in_(service_ids)).all()
        total_duration = sum(
            int(getattr(service, "duration_minutes", 30) or 30)
            for service in services
        )

    available_slots = booking_scheduler.list_available_slots(
        db,
        booking_date=booking_date,
        total_duration_minutes=total_duration,
        barbers=barbers,
        strict_schedule=True,
    )

    return {"available_slots": available_slots}


@router.post(
    "/booking",
    response_model=PublicBookingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(
            rate_limit(
                "public_booking_create",
                max_requests=settings.PUBLIC_RATE_LIMIT_MAX_REQUESTS,
                window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
def create_public_booking(
    payload: PublicBookingCreate,
    db: Session = Depends(get_db),
    member: Customer | None = Depends(get_optional_member),
):
    if not payload.services:
        raise HTTPException(
            status_code=400,
            detail="يجب اختيار خدمة واحدة على الأقل",
        )

    # احسب مدة الخدمات المختارة
    total_duration = 0
    for s_item in payload.services:
        s_model = db.query(Service).filter(Service.id == s_item.service_id).first()
        if s_model:
            total_duration += (getattr(s_model, "duration_minutes", 30) or 30) * s_item.quantity
    if total_duration == 0: total_duration = 30

    if payload.barber_id:
        barber = db.query(Employee).filter(Employee.id == payload.barber_id).first()
        if not barber:
            raise HTTPException(status_code=404, detail="الحلاق غير موجود")
        
        # تحقق من التوفر لهذا الحلاق تحديداً
        available_barbers = booking_scheduler.get_available_barbers_for_slot(
            db,
            booking_date=payload.appointment_date,
            appointment_time=payload.appointment_time,
            total_duration_minutes=total_duration,
            barbers=[barber],
            strict_schedule=True,
        )
        if not available_barbers:
            raise HTTPException(
                status_code=409,
                detail="هذا الموعد لم يعد متاحاً مع هذا الحلاق، اختر وقتاً آخر",
            )
    else:
        # البحث عن أي حلاق متاح
        barbers = db.query(Employee).filter(
            Employee.is_active == True,
            Employee.show_in_booking == True
        ).all()
        
        try:
            barber = booking_scheduler.auto_assign_barber(
                db,
                booking_date=payload.appointment_date,
                appointment_time=payload.appointment_time,
                total_duration_minutes=total_duration,
                barbers=barbers,
                strict_schedule=True,
                no_barber_detail="عذراً، لا يوجد حلاق متاح في هذا الوقت"
            )
        except HTTPException as e:
            raise e

    appointment_dt = datetime.combine(payload.appointment_date, payload.appointment_time)
    if appointment_dt <= datetime.now():
        raise HTTPException(
            status_code=400,
            detail="لا يمكن إنشاء حجز في وقت ماضٍ",
        )

    customer = _get_or_create_customer(db, payload, member)

    appointment = Appointment(
        customer_id=customer.customer_id,
        barber_id=barber.id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        status="pending",
        notes=payload.notes,
        created_by_user_id=None,
        updated_by_user_id=None,
    )
    db.add(appointment)
    db.flush()

    _rebuild_appointment_services_public(db, appointment, payload.services)

    db.commit()
    db.refresh(appointment)

    business_settings = db.query(BusinessSettings).first()
    public_slug = payload.salon_slug or (
        business_settings.public_slug if business_settings else None
    )
    publish_booking_event(
        public_slug or "default",
        "booking.created",
        {
            "bookingId": appointment.id,
            "status": appointment.status,
            "scheduledAt": datetime.combine(
                appointment.appointment_date,
                appointment.appointment_time,
            ).isoformat(),
        },
    )

    # إشعارات داخل النظام
    cashier_notification = Notification(
        user_role="cashier",
        title="حجز جديد",
        message=f"وصل حجز جديد من العميل {customer.first_name} {customer.last_name}",
    )
    manager_notification = Notification(
        user_role="manager",
        title="حجز جديد",
        message=f"تم إنشاء حجز جديد مع الحلاق {barber.display_name or barber.full_name}",
    )
    barber_notification = Notification(
        user_role="barber",
        title="موعد جديد",
        message=f"لديك حجز جديد يوم {appointment.appointment_date} الساعة {appointment.appointment_time}",
    )

    db.add(cashier_notification)
    db.add(manager_notification)
    db.add(barber_notification)
    db.commit()

    # إرسال تأكيد واتساب — لا نكسر الحجز لو فشل الإرسال
    try:
        send_booking_confirmation_template(
            db,
            to_phone=customer.phone,
            customer_name=f"{customer.first_name} {customer.last_name}".strip(),
            appointment_date=str(appointment.appointment_date),
            appointment_time=str(appointment.appointment_time),
            barber_name=barber.display_name or barber.full_name,
            appointment_id=appointment.id,
        )
        db.commit()
    except Exception as exc:
        logger.warning("Public booking WhatsApp send failed: %s", str(exc))

    return PublicBookingResponse(
        message="تم تسجيل الحجز بنجاح",
        appointment_id=appointment.id,
        customer_id=customer.customer_id,
    )


@router.get(
    "/realtime/booking/{slug}/poll",
    dependencies=[
        Depends(
            rate_limit(
                "public_booking_realtime_poll",
                max_requests=settings.PUBLIC_RATE_LIMIT_MAX_REQUESTS,
                window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
def poll_booking_events(slug: str, after: int = 0):
    events = _events_after(slug, max(0, after))
    return {
        "sequence": events[-1]["sequence"] if events else max(0, after),
        "event": events[-1]["event"] if events else None,
    }


@router.get(
    "/realtime/booking/{slug}",
    dependencies=[
        Depends(
            rate_limit(
                "public_booking_realtime_stream",
                max_requests=settings.PUBLIC_RATE_LIMIT_MAX_REQUESTS,
                window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
async def stream_booking_events(slug: str, request: Request):
    async def event_stream():
        sequence = _latest_sequence(slug)
        last_heartbeat = time.monotonic()
        while not await request.is_disconnected():
            pending = _events_after(slug, sequence)
            for item in pending:
                sequence = item["sequence"]
                event = item["event"]
                yield (
                    f"event: {event['type']}\n"
                    f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                )
            if not pending and time.monotonic() - last_heartbeat >= 15:
                yield ": keep-alive\n\n"
                last_heartbeat = time.monotonic()
            await asyncio.sleep(1)
        yield "event: close\ndata: {}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
