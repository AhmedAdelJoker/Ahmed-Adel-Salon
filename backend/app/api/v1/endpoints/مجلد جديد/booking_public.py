from fastapi.middleware.cors import CORSMiddleware
from decimal import Decimal
from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.service import Service
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.business_settings import BusinessSettings
from app.models.notification import Notification
from app.models.user import User
from app.models.service_category import ServiceCategory
from app.models.offer import Offer, OfferService

from app.core.customer_names import compose_customer_name
from app.schemas.booking import PublicBookingCreate, PublicBookingResponse
from app.services.public_site_settings import serialize_public_business
from app.services.booking_scheduler import (
    auto_assign_barber,
    calculate_total_duration_minutes,
    list_assignable_barbers,
    list_available_slots,
)
from app.services.meta_whatsapp_service import send_booking_confirmation_template

router = APIRouter(prefix="/public", tags=["Public Booking"])


def _get_or_create_customer(db: Session, payload: PublicBookingCreate) -> Customer:
    customer = db.query(Customer).filter(Customer.phone == payload.phone).first()

    if customer:
        customer.first_name = payload.first_name
        customer.last_name = payload.last_name or ""
        customer.email = payload.email
        db.add(customer)
        db.flush()
        return customer

    customer = Customer(
        first_name=payload.first_name,
        last_name=payload.last_name or "",
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
@router.get("/booking-catalog")
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
    barbers = list_assignable_barbers(db, online_only=True)

    # Categories
    categories = (
        db.query(ServiceCategory)
        .filter(ServiceCategory.is_active == True)
        .order_by(ServiceCategory.sort_order.asc(), ServiceCategory.id.asc())
        .all()
    )

    # Active offers (public only)
    today = date.today()
    offers = (
        db.query(Offer)
        .filter(Offer.is_active == True, Offer.is_public == True)
        .filter((Offer.start_date == None) | (Offer.start_date <= today))
        .filter((Offer.end_date == None) | (Offer.end_date >= today))
        .order_by(Offer.id.desc())
        .all()
    )

    # Build offer responses with services
    offer_responses = []
    for o in offers:
        offer_svcs = db.query(OfferService).filter(OfferService.offer_id == o.id).all()
        svc_ids = [os.service_id for os in offer_svcs]
        svc_list = db.query(Service).filter(Service.id.in_(svc_ids)).all() if svc_ids else []
        offer_responses.append({
            "id": o.id,
            "name": o.name,
            "name_ar": o.name_ar,
            "description": o.description,
            "discount_type": o.discount_type,
            "discount_value": float(o.discount_value or 0),
            "original_price": float(o.original_price or 0),
            "offer_price": float(o.offer_price or 0),
            "image_url": getattr(o, "image_url", None),
            "description_ar": getattr(o, "description_ar", None),
            "description_en": getattr(o, "description_en", None),
            "start_date": str(o.start_date) if o.start_date else None,
            "end_date": str(o.end_date) if o.end_date else None,
            "services": [{"id": s.id, "name": s.name, "price": float(s.price or 0), "duration_minutes": int(getattr(s, "duration_minutes", 30) or 30)} for s in svc_list],
        })

    return {
        "business": serialize_public_business(settings_row),
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "name_ar": c.name_ar,
                "icon": c.icon,
                "sort_order": c.sort_order,
            }
            for c in categories
        ],
        "services": [
            {
                "id": s.id,
                "name": s.name,
                "name_ar": s.name_ar,
                "name_en": s.name_en,
                "price": float(s.price or 0),
                "duration_minutes": int(getattr(s, "duration_minutes", 30) or 30),
                "category_id": s.category_id,
                "image_url": getattr(s, "image_url", None),
                "description_ar": s.description_ar,
                "description_en": s.description_en,
            }
            for s in services
        ],
        "offers": offer_responses,
        "barbers": [
            {
                "id": b.id,
                "display_name": b.display_name,
                "profile_image_url": b.profile_image_url,
                "bio_ar": getattr(b, "bio_ar", None),
                "bio_en": getattr(b, "bio_en", None),
                "job_title": b.job_title,
            }
            for b in barbers
        ],
    }


@router.get("/time-slots")
def get_time_slots(
    barber_id: int | None = Query(default=None),
    booking_date: date = Query(...),
    service_ids: List[int] = Query(default=[]),
    db: Session = Depends(get_db),
):
    if barber_id is not None:
        barber = db.query(Employee).filter(Employee.id == barber_id).first()
        if not barber:
            raise HTTPException(status_code=404, detail="الحلاق غير موجود")
        target_barbers = [barber]
    else:
        target_barbers = list_assignable_barbers(db, online_only=True)

    if service_ids:
        services = db.query(Service).filter(Service.id.in_(service_ids)).all()
        total_duration = sum(
            int(getattr(service, "duration_minutes", 30) or 30)
            for service in services
        ) or 30
    else:
        total_duration = 30

    return {
        "available_slots": list_available_slots(
            db,
            booking_date=booking_date,
            total_duration_minutes=total_duration,
            barbers=target_barbers,
            strict_schedule=True,
        )
    }


@router.post(
    "/booking",
    response_model=PublicBookingResponse,
    status_code=status.HTTP_201_CREATED,
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

    total_duration_minutes = calculate_total_duration_minutes(db, payload.services)
    if payload.barber_id is not None:
        selected_barber = db.query(Employee).filter(Employee.id == payload.barber_id).first()
        if not selected_barber:
            raise HTTPException(status_code=404, detail="الحلاق غير موجود")
        target_barbers = [selected_barber]
    else:
        target_barbers = list_assignable_barbers(db, online_only=True)

    barber = auto_assign_barber(
        db,
        booking_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        total_duration_minutes=total_duration_minutes,
        barbers=target_barbers,
        strict_schedule=True,
        no_barber_detail="لا يوجد حلاق متاح في هذا الوقت، اختر وقتًا آخر",
    )

    customer = _get_or_create_customer(db, payload)

    start_at = datetime.combine(payload.appointment_date, payload.appointment_time)
    
    appointment = Appointment(
        customer_id=customer.customer_id,
        employee_id=barber.id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        start_at=start_at,
        source="website",
        requested_employee_id=payload.barber_id,
        status="pending",
        notes=payload.notes,
        created_by_user_id=None,
        updated_by_user_id=None,
    )
    db.add(appointment)
    db.flush()

    _rebuild_appointment_services_public(db, appointment, payload.services)
    
    # Update end_at based on calculated duration
    appointment.end_at = start_at + timedelta(minutes=appointment.total_estimated_duration_minutes)

    db.commit()
    db.refresh(appointment)
    appointment_id = appointment.id
    customer_id = customer.customer_id

    # إشعارات داخل النظام
    cashier_users = (
        db.query(User)
        .filter(User.role == "cashier", User.is_active == True)
        .all()
    )
    manager_users = (
        db.query(User)
        .filter(User.role.in_(["manager", "owner"]), User.is_active == True)
        .all()
    )
    barber_users = (
        db.query(User)
        .filter(User.role == "barber", User.barber_id == barber.id, User.is_active == True)
        .all()
    )

    customer_name = compose_customer_name(customer.first_name, customer.last_name)

    for user in cashier_users:
        db.add(
            Notification(
                user_id=user.id,
                user_role=user.role,
                title="حجز جديد",
                message=f"وصل حجز جديد من العميل {customer_name}",
            )
        )
    for user in manager_users:
        db.add(
            Notification(
                user_id=user.id,
                user_role=user.role,
                title="حجز جديد",
                message=f"تم إنشاء حجز جديد مع الحلاق {barber.display_name}",
            )
        )
    for user in barber_users:
        db.add(
            Notification(
                user_id=user.id,
                user_role=user.role,
                title="موعد جديد",
                message=f"لديك حجز جديد يوم {appointment.appointment_date} الساعة {appointment.appointment_time}",
            )
        )
    db.commit()

    # إرسال تأكيد واتساب — لا نكسر الحجز لو فشل الإرسال
    try:
        send_booking_confirmation_template(
            db,
            to_phone=customer.phone,
            customer_name=customer_name,
            appointment_date=str(appointment.appointment_date),
            appointment_time=str(appointment.appointment_time),
            barber_name=barber.display_name,
            appointment_id=appointment_id,
        )
        db.commit()
    except Exception as exc:
        try:
            db.commit()
        except Exception:
            db.rollback()
        print("Public booking WhatsApp send failed:", str(exc))

    return PublicBookingResponse(
        message="تم تسجيل الحجز بنجاح",
        appointment_id=appointment_id,
        customer_id=customer_id,
        assigned_barber_id=barber.id,
        assigned_barber_name=barber.display_name,
    )



