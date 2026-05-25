import logging
from decimal import Decimal
from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.customer import Customer
from app.models.barber import Barber
from app.models.service import Service
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.business_settings import BusinessSettings
from app.models.barber_working_hour import BarberWorkingHour
from app.models.barber_time_off import BarberTimeOff
from app.models.notification import Notification

from app.schemas.booking import PublicBookingCreate, PublicBookingResponse
from app.core.config import settings
from app.core.rate_limit import rate_limit
from app.services.meta_whatsapp_service import send_booking_confirmation_template

router = APIRouter(prefix="/public", tags=["Public Booking"])
logger = logging.getLogger(__name__)


def _get_or_create_customer(db: Session, payload: PublicBookingCreate) -> Customer:
    customer = db.query(Customer).filter(Customer.phone == payload.phone).first()

    if customer:
        customer.first_name = payload.first_name
        customer.last_name = payload.last_name
        customer.email = payload.email
        db.add(customer)
        db.flush()
        return customer

    customer = Customer(
        first_name=payload.first_name,
        last_name=payload.last_name,
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
    barbers = db.query(Barber).order_by(Barber.id.asc()).all()

    return {
        "business": {
            "salon_name": settings_row.salon_name if settings_row else "SalonPro",
            "shop_phone": settings_row.shop_phone if settings_row else None,
            "shop_whatsapp": settings_row.shop_whatsapp if settings_row else None,
        },
        "services": [
            {
                "id": s.id,
                "name": s.name,
                "price": float(s.price or 0),
                "duration_minutes": int(getattr(s, "duration_minutes", 30) or 30),
            }
            for s in services
        ],
        "barbers": [
            {
                "id": b.id,
                "display_name": b.display_name,
            }
            for b in barbers
        ],
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
    barber_id: int = Query(...),
    booking_date: date = Query(...),
    service_ids: List[int] = Query(default=[]),
    db: Session = Depends(get_db),
):
    barber = db.query(Barber).filter(Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")

    # تحقق من الإجازة
    off_day = (
        db.query(BarberTimeOff)
        .filter(
            BarberTimeOff.barber_id == barber_id,
            BarberTimeOff.off_date == booking_date,
        )
        .first()
    )
    if off_day:
        return {"available_slots": []}

    # weekday() في Python:
    # Monday=0 ... Sunday=6
    day_of_week = booking_date.weekday()

    working_hour = (
        db.query(BarberWorkingHour)
        .filter(
            BarberWorkingHour.barber_id == barber_id,
            BarberWorkingHour.day_of_week == day_of_week,
            BarberWorkingHour.is_active == True,
        )
        .first()
    )
    if not working_hour:
        return {"available_slots": []}

    # احسب مدة الخدمات المختارة
    if service_ids:
        services = db.query(Service).filter(Service.id.in_(service_ids)).all()
        total_duration = sum(
            int(getattr(service, "duration_minutes", 30) or 30)
            for service in services
        )
    else:
        total_duration = 30

    booked_appointments = (
        db.query(Appointment)
        .filter(
            Appointment.barber_id == barber_id,
            Appointment.appointment_date == booking_date,
            Appointment.status.in_(["pending", "confirmed"]),
        )
        .order_by(Appointment.appointment_time.asc())
        .all()
    )

    busy_intervals = []
    for appointment in booked_appointments:
        appt_start = datetime.combine(booking_date, appointment.appointment_time)
        appt_end = appt_start + timedelta(
            minutes=int(appointment.total_estimated_duration_minutes or 30)
        )
        busy_intervals.append((appt_start, appt_end))

    current = datetime.combine(booking_date, working_hour.start_time)
    end_dt = datetime.combine(booking_date, working_hour.end_time)

    slot_step = 30  # نتحرك كل نصف ساعة
    available_slots = []

    while current + timedelta(minutes=total_duration) <= end_dt:
        slot_start = current
        slot_end = current + timedelta(minutes=total_duration)

        has_conflict = False
        for busy_start, busy_end in busy_intervals:
            if slot_start < busy_end and slot_end > busy_start:
                has_conflict = True
                break

        if not has_conflict:
            available_slots.append(slot_start.time().strftime("%H:%M"))

        current += timedelta(minutes=slot_step)

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
):
    if not payload.services:
        raise HTTPException(
            status_code=400,
            detail="يجب اختيار خدمة واحدة على الأقل",
        )

    barber = db.query(Barber).filter(Barber.id == payload.barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    appointment_dt = datetime.combine(payload.appointment_date, payload.appointment_time)
    if appointment_dt <= datetime.now():
        raise HTTPException(
            status_code=400,
            detail="لا يمكن إنشاء حجز في وقت ماضٍ",
        )

    # منع الحجز في نفس الوقت لنفس الحلاق
    existing = (
        db.query(Appointment)
        .filter(
            Appointment.barber_id == payload.barber_id,
            Appointment.appointment_date == payload.appointment_date,
            Appointment.appointment_time == payload.appointment_time,
            Appointment.status.in_(["pending", "confirmed"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="هذا الموعد محجوز بالفعل، اختر وقتًا آخر",
        )

    customer = _get_or_create_customer(db, payload)

    appointment = Appointment(
        customer_id=customer.customer_id,
        barber_id=payload.barber_id,
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

    # إشعارات داخل النظام
    cashier_notification = Notification(
        user_role="cashier",
        title="حجز جديد",
        message=f"وصل حجز جديد من العميل {customer.first_name} {customer.last_name}",
    )
    manager_notification = Notification(
        user_role="manager",
        title="حجز جديد",
        message=f"تم إنشاء حجز جديد مع الحلاق {barber.display_name}",
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
            barber_name=barber.display_name,
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
