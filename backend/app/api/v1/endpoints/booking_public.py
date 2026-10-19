import asyncio
import json
import logging
import threading
import time
from collections import deque
from decimal import Decimal
from datetime import date, datetime, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

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
from app.core.clock import salon_now, utc_now_naive
from app.core.employee_rules import (
    SERVICE_PROVIDER_JOB_TITLES,
    is_service_provider_job_title,
)
from app.core.rate_limit import rate_limit
from app.core.working_hours import public_payload
from app.services import booking_scheduler
from app.services.meta_whatsapp_service import send_booking_confirmation_template

router = APIRouter(prefix="/public", tags=["Public Booking"])
logger = logging.getLogger(__name__)


def _as_bool(value: Any) -> bool:
    """Coerce a stored setting to a real boolean.

    The snapshot is JSON, and a setting the owner never touched comes back as
    `None`. Forwarding that unchanged is fine, but forwarding the *string*
    `"false"` is not: every truthiness check on the client — `landing_show_staff`
    gates the whole team section — treats the non-empty string as true, so a
    salon that hid its staff got the section shown anyway.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _json_safe(value: Any, default: Any) -> Any:
    """Return a JSON column's value in a shape the client can render.

    `public_payload` is working-hours-specific and always returns a dict, so it
    cannot serve the list-valued settings (`landing_portfolio` is a list of URLs,
    `landing_stats` a list of objects). SQLAlchemy hands these back already
    decoded, but a column can also hold a JSON *string* from an older write, and
    passing that through would hand the client a string where it expects a list.
    """
    if value is None:
        return default
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
        except (ValueError, TypeError):
            return default
        return decoded
    return value
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
    if (
        settings_row is None
        or settings_row.public_site_published_at is None
        or not settings_row.public_site_snapshot
    ):
        raise HTTPException(status_code=404, detail="الموقع العام غير منشور بعد")
    public_settings = settings_row.public_site_snapshot
    services = (
        db.query(Service)
        .filter(Service.is_active == True)
        .order_by(Service.id.asc())
        .all()
    )
    # Who counts as publicly bookable is a classification, not a text match:
    # every service-providing title (barber, colorist, esthetician) is served
    # when the owner's switch is on, while an accountant, cashier, manager,
    # admin or unlinked assistant never is. The previous
    # `job_title ILIKE '%barber%'` both hid the colour and skin specialists and
    # could admit a `barber_assistant`.
    barbers = (
        db.query(Employee)
        .filter(
            Employee.is_active == True,
            Employee.show_in_booking == True,
            Employee.status == "active",
            Employee.job_title.in_(list(SERVICE_PROVIDER_JOB_TITLES)),
        )
        # `display_order` is the rank the admin sets in `/employees`; ordering by
        # id here ignored it, so re-ordering staff never reached the public site.
        .order_by(Employee.display_order.asc(), Employee.id.asc())
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
    #
    # `is_active` + `is_public` alone let an offer whose window ended weeks ago
    # keep being served, so the site would keep advertising a price the salon no
    # longer honours. `/offers/active` has always applied the date window; the
    # public catalog diverged from it.
    today_date = (salon_now() or utc_now_naive()).date()
    try:
        offers = (
            db.query(Offer)
            .filter(Offer.is_active == True)
            .filter(Offer.is_public == True)
            .filter(
                or_(
                    Offer.start_date.is_(None),
                    Offer.start_date <= today_date,
                )
            )
            .filter(
                or_(
                    Offer.end_date.is_(None),
                    Offer.end_date >= today_date,
                )
            )
            .order_by(Offer.id.desc())
            .all()
        )
    except Exception as e:
        logger.error(f"Error fetching offers: {e}")
        offers = []

    return {
        "business": {
            "salon_name": public_settings.get("salon_name") or "SalonPro",
            "shop_phone": public_settings.get("shop_phone"),
            "shop_whatsapp": public_settings.get("shop_whatsapp"),
            "address": public_settings.get("address"),
            "logo_url": public_settings.get("logo_url"),
            "working_hours": public_payload(public_settings.get("working_hours")),
            "public_slug": public_settings.get("public_slug"),
            # ── Identity and presentation ────────────────────────────
            # These were all snapshotted by `publish-site` and all read by the
            # public site, but none of them reached the payload. The effect was
            # that a salon's chosen palette, currency and social links were
            # silently dropped: the site fell back to its own defaults, so
            # editing them in the settings panel appeared to do nothing.
            #
            # `landing_theme_id` is the one that matters most — it selects the
            # whole colour scheme the site paints itself with.
            "currency": public_settings.get("currency"),
            "landing_theme_id": public_settings.get("landing_theme_id"),
            "google_maps_url": public_settings.get("google_maps_url"),
            "social_facebook": public_settings.get("social_facebook"),
            "social_instagram": public_settings.get("social_instagram"),
            "social_tiktok": public_settings.get("social_tiktok"),
            "social_youtube": public_settings.get("social_youtube"),
            # ── Owner-authored copy ──────────────────────────────────
            "landing_cover_image_url": public_settings.get("landing_cover_image_url"),
            # Hero video + motion. Without these three the owner could upload a
            # clip, publish, and the public site would never receive it — the
            # snapshot carried the values but this projection dropped them, so
            # the landing page fell back to the still image every time.
            "landing_hero_video_url": public_settings.get("landing_hero_video_url"),
            "landing_video_poster_url": public_settings.get("landing_video_poster_url"),
            "landing_video_autoplay": public_settings.get("landing_video_autoplay"),
            "landing_video_muted": public_settings.get("landing_video_muted"),
            "landing_motion_enabled": public_settings.get("landing_motion_enabled"),
            "landing_hero_title": public_settings.get("landing_hero_title"),
            "landing_hero_subtitle": public_settings.get("landing_hero_subtitle"),
            "landing_hero_badge": public_settings.get("landing_hero_badge"),
            "landing_about_title": public_settings.get("landing_about_title"),
            "landing_about_content": public_settings.get("landing_about_content"),
            "landing_about_eyebrow": public_settings.get("landing_about_eyebrow"),
            # The about photograph, its alt text, and the years badge. These ride
            # in the published snapshot rather than in a column, so the endpoint
            # has to forward them by name the way every other landing key is
            # forwarded -- there is no wildcard that would pick them up for free.
            "landing_about_image_url": public_settings.get("landing_about_image_url"),
            "landing_about_image_alt": public_settings.get("landing_about_image_alt"),
            "landing_about_years_experience": public_settings.get(
                "landing_about_years_experience"
            ),
            # `landing_features` is a JSON list, not a string. Forwarded through
            # `_json_safe` so the client receives an array whether the column
            # holds a decoded list or a string from an older write.
            "landing_features": _json_safe(public_settings.get("landing_features"), []),
            "landing_services_eyebrow": public_settings.get("landing_services_eyebrow"),
            "landing_services_title": public_settings.get("landing_services_title"),
            "landing_services_subtitle": public_settings.get("landing_services_subtitle"),
            "landing_portfolio_eyebrow": public_settings.get("landing_portfolio_eyebrow"),
            "landing_portfolio_title": public_settings.get("landing_portfolio_title"),
            "landing_portfolio": _json_safe(public_settings.get("landing_portfolio"), []),
            "landing_booking_eyebrow": public_settings.get("landing_booking_eyebrow"),
            "landing_booking_title": public_settings.get("landing_booking_title"),
            "landing_booking_subtitle": public_settings.get("landing_booking_subtitle"),
            "landing_location_eyebrow": public_settings.get("landing_location_eyebrow"),
            "landing_location_title": public_settings.get("landing_location_title"),
            "landing_location_description": public_settings.get("landing_location_description"),
            "landing_location_open_label": public_settings.get("landing_location_open_label"),
            "landing_location_closed_label": public_settings.get("landing_location_closed_label"),
            "landing_location_status_text": public_settings.get("landing_location_status_text"),
            "landing_contact_eyebrow": public_settings.get("landing_contact_eyebrow"),
            "landing_contact_title": public_settings.get("landing_contact_title"),
            "landing_contact_subtitle": public_settings.get("landing_contact_subtitle"),
            "landing_quick_actions_eyebrow": public_settings.get("landing_quick_actions_eyebrow"),
            "landing_quick_actions_title": public_settings.get("landing_quick_actions_title"),
            "landing_quick_actions_subtitle": public_settings.get("landing_quick_actions_subtitle"),
            "landing_final_title": public_settings.get("landing_final_title"),
            "landing_final_subtitle": public_settings.get("landing_final_subtitle"),
            "landing_final_button_label": public_settings.get("landing_final_button_label"),
            "landing_hero_highlight_title": public_settings.get("landing_hero_highlight_title"),
            "landing_hero_highlight_subtitle": public_settings.get("landing_hero_highlight_subtitle"),
            "landing_hero_highlight_badge": public_settings.get("landing_hero_highlight_badge"),
            "landing_public_header_badge": public_settings.get("landing_public_header_badge"),
            "landing_testimonials_eyebrow": public_settings.get("landing_testimonials_eyebrow"),
            "landing_testimonials_title": public_settings.get("landing_testimonials_title"),
            "landing_testimonials_subtitle": public_settings.get("landing_testimonials_subtitle"),
            # Booleans must survive as booleans: `landing_show_staff` gates the
            # team section, and a plain truthiness check on the string "false"
            # would show the section to a salon that hid it.
            "landing_show_staff": _as_bool(public_settings.get("landing_show_staff")),
            "landing_show_staff_bio": _as_bool(public_settings.get("landing_show_staff_bio")),
            # Structured content the public site renders directly.
            # (`landing_features` and `landing_portfolio` were also declared
            # above, beside their section's copy keys — declaring them twice
            # here made the dict's real value depend on reading order.)
            "landing_stats": _json_safe(public_settings.get("landing_stats"), []),
            "landing_trust_badges": _json_safe(public_settings.get("landing_trust_badges"), []),
            "landing_testimonials": _json_safe(public_settings.get("landing_testimonials"), []),
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
                # The services this offer covers.
                #
                # `Offer.offer_services` has always existed in the model, but this
                # payload never included it — so the public site could display an
                # offer's price and had no way to know which services the offer
                # applied to. An offer is a discount *on something*; without this
                # the visitor had to work that out themselves, and `?offer=<id>`
                # could not preselect anything.
                "service_ids": [
                    link.service_id for link in (o.offer_services or []) if link.service_id
                ],
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
    # Time slots follow the same bookability predicate as the catalog: an
    # inactive, on-leave, switched-off or non-service employee has no public
    # slots — a direct `barber_id` link cannot resurrect one the catalog hides.
    bookable = [
        Employee.is_active == True,  # noqa: E712
        Employee.show_in_booking == True,  # noqa: E712
        Employee.status == "active",
        Employee.job_title.in_(list(SERVICE_PROVIDER_JOB_TITLES)),
    ]
    if barber_id:
        barbers = db.query(Employee).filter(Employee.id == barber_id, *bookable).all()
        if not barbers:
            raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    else:
        barbers = db.query(Employee).filter(*bookable).all()

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

    published_settings = db.query(BusinessSettings).first()
    if (
        published_settings is None
        or published_settings.public_site_published_at is None
        or not published_settings.public_site_snapshot
    ):
        raise HTTPException(status_code=404, detail="الموقع العام غير منشور بعد")

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

        # Existence is not availability: a barber on leave (suspended), an
        # employee hidden from booking, or an administrative row must not
        # receive an online appointment through a stale link.
        if (
            not barber.is_active
            or barber.status != "active"
            or not barber.show_in_booking
            or not is_service_provider_job_title(barber.job_title)
        ):
            raise HTTPException(
                status_code=409,
                detail="هذا الحلاق غير متاح للحجز حالياً، اختر حلاقاً آخر",
            )

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
        # البحث عن أي حلاق متاح — بين مزودي الخدمة النشطين فقط
        barbers = (
            db.query(Employee)
            .filter(
                Employee.is_active == True,  # noqa: E712
                Employee.show_in_booking == True,  # noqa: E712
                Employee.status == "active",
                Employee.job_title.in_(list(SERVICE_PROVIDER_JOB_TITLES)),
            )
            .all()
        )
        
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
