from pathlib import Path
from datetime import date, datetime, timedelta, time
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.customer import Customer
from app.models.service import Service
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.business_settings import BusinessSettings
from app.models.service_session import ServiceSession

from app.schemas.appointment import (
    AppointmentAssignBarberPayload,
    AppointmentCreate,
    AppointmentFastWalkinCreate,
    AppointmentMovePayload,
    AppointmentRead,
    AppointmentServiceItemCreate,
    AppointmentStatusUpdate,
    AppointmentUpdate,
    BarberAppointmentsResponse,
    BarberAppointmentStats,
)
from app.schemas.invoice import IssueInvoiceResponse

from app.api.deps import require_any_staff, require_cashier_manager_owner
from app.services.activity_service import log_activity
from app.services.meta_whatsapp_service import (
    send_appointment_reminder_24h_template,
    send_appointment_reminder_2h_template,
    send_text_message,
    upload_and_send_pdf,
)
from app.services.pdf_service import generate_invoice_pdf
from app.services.inventory_service import deduct_stock_for_invoice
from app.services.websocket import manager

import json

def log_booking_change(db: Session, appointment_id: int, user_id: int | None, action: str, old_val: dict = None, new_val: dict = None):
    from app.models.booking_audit_log import BookingAuditLog
    changes = {}
    if old_val and new_val:
        diff = {k: {"old": old_val.get(k), "new": new_val.get(k)} for k in new_val if new_val.get(k) != old_val.get(k)}
        changes = diff
    elif new_val:
        changes = {"created": new_val}
    elif old_val:
        changes = {"deleted": old_val}
        
    log = BookingAuditLog(
        appointment_id=appointment_id,
        user_id=user_id,
        action=action,
        changes=json.dumps(changes, ensure_ascii=False)
    )
    db.add(log)

router = APIRouter(prefix="/appointments", tags=["Appointments"])

ACTIVE_BOOKING_STATUSES = {"pending", "confirmed", "waiting"}

def _appointment_to_read(db: Session, appointment: Appointment) -> AppointmentRead:
    customer = db.query(Customer).filter(Customer.customer_id == appointment.customer_id).first()
    barber = db.query(Employee).filter(Employee.id == appointment.barber_id).first()
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
        customer_name=(f"{customer.first_name or ''} {customer.last_name or ''}".strip() if customer else "عميل مجهول"),
        customer_phone=customer.phone if customer else None,
        barber_name=(barber.display_name or barber.full_name) if barber else "غير محدد",
        services=appointment.services or [],
    )

def _rebuild_appointment_services(db: Session, appointment: Appointment, items: list):
    db.query(AppointmentService).filter(AppointmentService.appointment_id == appointment.id).delete()
    total_price = Decimal("0.00")
    total_duration = 0
    rows = []
    for item in items:
        service_id = item.get("serviceId") if isinstance(item, dict) else getattr(item, "service_id", None)
        quantity = item.get("quantity", 1) if isinstance(item, dict) else getattr(item, "quantity", 1)
        
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            continue
            
        qty = quantity or 1
        price = Decimal(str(service.price or 0))
        duration = int(getattr(service, "duration_minutes", 30) or 30)
        total_price += price * qty
        total_duration += duration * qty
        rows.append(AppointmentService(appointment_id=appointment.id, service_id=service.id, service_name_snapshot=service.name, price_snapshot=price, duration_snapshot_minutes=duration, quantity=qty, is_active=True, is_changed=False))
    
    db.add_all(rows)
    appointment.total_estimated_price = total_price
    appointment.total_estimated_duration_minutes = total_duration

def _is_within_shop_hours(db: Session, appt_date: date, appt_time: time, duration_minutes: int) -> bool:
    if isinstance(appt_time, str):
        try:
            appt_time = time.fromisoformat(appt_time[:5])
        except Exception:
            pass

    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return True
    
    day_name = appt_date.strftime("%A").lower()
    day_config = settings.working_hours.get(day_name)
    
    if not day_config or not day_config.get("is_open"):
        return False
        
    shop_open_str = day_config.get("open_time")
    shop_close_str = day_config.get("close_time")
    
    if not shop_open_str or not shop_close_str:
        return True
        
    try:
        shop_open_time = datetime.strptime(shop_open_str, "%H:%M").time()
        shop_close_time = datetime.strptime(shop_close_str, "%H:%M").time()
        
        appt_start_dt = datetime.combine(appt_date, appt_time)
        appt_end_dt = appt_start_dt + timedelta(minutes=duration_minutes)
        
        shop_open_dt = datetime.combine(appt_date, shop_open_time)
        shop_close_dt = datetime.combine(appt_date, shop_close_time)
        
        # Handle overnight shop hours if necessary, but usually shops close same day
        if shop_close_time < shop_open_time:
            shop_close_dt += timedelta(days=1)
            
        return appt_start_dt >= shop_open_dt and appt_end_dt <= shop_close_dt
    except Exception:
        return True

def _validate_future_datetime(appt_date: date, appt_time: time):
    if isinstance(appt_time, str):
        try:
            appt_time = time.fromisoformat(appt_time[:5])
        except Exception:
            pass
            
    now = datetime.now()
    today = date.today()
    
    # 1. Block past dates
    if appt_date < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="عذراً، لا يمكن تسجيل حجز في تاريخ مضى. يرجى اختيار تاريخ اليوم أو مستقبلي."
        )
    
    # 2. Block past times for today
    if appt_date == today:
        buffer = timedelta(minutes=5)
        target_dt = datetime.combine(appt_date, appt_time)
        if target_dt < (now - buffer):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="عذراً، لا يمكن تسجيل حجز في وقت مضى. يرجى اختيار موعد يبدأ من الوقت الحالي."
            )

def _handle_shop_hours_and_status(db: Session, appt_date: date, appt_time: time, duration: int, current_status: str):
    """
    Check if booking is within shop hours. If outside, auto-cancel.
    """
    if not _is_within_shop_hours(db, appt_date, appt_time, duration):
        return "cancelled", "تم الإلغاء آلياً لتجاوزه ساعات عمل المحل الرسمية"
    return current_status, None

def _ensure_available_slot(
    db: Session,
    *,
    barber_id: int,
    appointment_date: date,
    appointment_time: time,
    duration_minutes: int,
    exclude_appointment_id: int | None = None,
) -> None:
    if isinstance(appointment_time, str):
        try:
            appointment_time = time.fromisoformat(appointment_time[:5])
        except Exception:
            pass

    # 1. Check shop hours first
    if not _is_within_shop_hours(db, appointment_date, appointment_time, duration_minutes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="الموعد المطلوب خارج ساعات عمل المحل الرسمية لهذا اليوم."
        )

    # 2. Check for overlaps with other appointments
    new_start_dt = datetime.combine(appointment_date, appointment_time)
    new_end_dt = new_start_dt + timedelta(minutes=duration_minutes)

    query = db.query(Appointment).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date == appointment_date,
        Appointment.status.in_(ACTIVE_BOOKING_STATUSES),
    )
    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)

    existing_appointments = query.all()
    for appt in existing_appointments:
        # Calculate existing appt end time
        duration = appt.total_estimated_duration_minutes or 30
        exist_start_dt = datetime.combine(appt.appointment_date, appt.appointment_time)
        exist_end_dt = exist_start_dt + timedelta(minutes=duration)
        
        # Check overlap logic: (StartA < EndB) and (EndA > StartB)
        if new_start_dt < exist_end_dt and new_end_dt > exist_start_dt:
            barber = db.query(Employee).filter(Employee.id == barber_id).first()
            barber_name = barber.display_name if barber else "الخبير"
            raise HTTPException(
                status_code=409,
                detail=f"يوجد تضارب في المواعيد: الخبير {barber_name} لديه حجز آخر في هذا التوقيت ({exist_start_dt.strftime('%H:%M')} - {exist_end_dt.strftime('%H:%M')}).",
            )

def _get_manageable_appointment(
    db: Session,
    appointment_id: int,
) -> Appointment:
    appointment = (
        db.query(Appointment)
        .options(joinedload(Appointment.services), joinedload(Appointment.invoices))
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    return appointment

def _ensure_existing_barber(db: Session, barber_id: int | None):
    if not barber_id:
        return None
    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الخبير غير موجود")
    return barber

def _generate_invoice_no(db: Session) -> str:
    today_prefix = datetime.now().strftime("INV-%Y%m%d")
    count_today = db.query(Invoice).filter(Invoice.invoice_no.like(f"{today_prefix}%")).count()
    return f"{today_prefix}-{count_today + 1:04d}"

# --- GET ENDPOINTS ---

@router.get("", response_model=list[AppointmentRead])
def list_appointments(
    date_filter: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    query = db.query(Appointment).options(joinedload(Appointment.services)).order_by(Appointment.id.desc())
    
    if date_filter == "today":
        query = query.filter(Appointment.appointment_date == date.today())
    elif date_filter == "custom" and start_date and end_date:
        query = query.filter(Appointment.appointment_date >= start_date, Appointment.appointment_date <= end_date)
    
    if current_user.role == "barber":
        barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
        if not barber_id:
            return []
        query = query.filter(Appointment.barber_id == barber_id)
        
    if limit:
        query = query.limit(limit)
    return [_appointment_to_read(db, row) for row in query.all()]

@router.get("/upcoming", response_model=list[AppointmentRead])
def list_upcoming_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    today = date.today()
    query = db.query(Appointment).options(joinedload(Appointment.services)).filter(
        Appointment.appointment_date >= today,
        Appointment.status.in_(["pending", "confirmed", "waiting"])
    ).order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc())

    if current_user.role == "barber":
        barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
        if barber_id:
            query = query.filter(Appointment.barber_id == barber_id)
            
    return [_appointment_to_read(db, row) for row in query.all()]

@router.get("/ready-for-payment", response_model=list[AppointmentRead])
def list_ready_appointments(db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    # A booking is truly 'ready for payment' only if it has the correct status AND no invoice has been issued yet.
    query = (
        db.query(Appointment)
        .options(joinedload(Appointment.services))
        .filter(
            Appointment.status == "ready_for_payment",
            ~Appointment.invoices.any() # Exclude any appointment that already has one or more invoices
        )
        .order_by(Appointment.appointment_date.desc(), Appointment.appointment_time.desc())
    )
    
    if current_user.role == "barber":
        barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
        if not barber_id:
            return []
        query = query.filter(Appointment.barber_id == barber_id)
        
    return [_appointment_to_read(db, row) for row in query.all()]

@router.get("/by-barber", response_model=List[BarberAppointmentsResponse])
def get_appointments_by_barber(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    query_date = target_date or date.today()
    barbers = db.query(Employee).filter(
        Employee.is_active == True,
        Employee.job_title.ilike("%barber%")
    ).all()
    
    appointments = db.query(Appointment).options(joinedload(Appointment.services)).filter(
        Appointment.appointment_date == query_date
    ).all()
    
    grouped = {}
    for barber in barbers:
        grouped[barber.id] = {
            "employee_id": barber.id,
            "employee_name": barber.display_name or barber.full_name,
            "barber": {
                "id": barber.id,
                "display_name": barber.display_name or barber.full_name,
                "profile_image_url": barber.profile_image_url
            },
            "appointments": [],
            "stats": BarberAppointmentStats()
        }
        
    grouped[None] = {
        "employee_id": None,
        "employee_name": "بدون خبير",
        "barber": None,
        "appointments": [],
        "stats": BarberAppointmentStats()
    }
    
    for appt in appointments:
        emp_id = appt.barber_id
        if emp_id not in grouped:
            emp = db.query(Employee).filter(Employee.id == emp_id).first()
            grouped[emp_id] = {
                "employee_id": emp_id,
                "employee_name": emp.display_name if emp else "خبير غير معروف",
                "barber": {
                    "id": emp.id if emp else emp_id,
                    "display_name": emp.display_name if emp else "خبير",
                    "profile_image_url": emp.profile_image_url if emp else None
                } if emp else None,
                "appointments": [],
                "stats": BarberAppointmentStats()
            }
            
        appt_read = _appointment_to_read(db, appt)
        grouped[emp_id]["appointments"].append(appt_read)
        
        stats = grouped[emp_id]["stats"]
        stats.total += 1
        st = appt.status.lower()
        if st == "in_progress": stats.in_progress += 1
        elif st == "ready_for_payment": stats.ready_for_payment += 1
        elif st in ["completed", "done"]: stats.completed += 1
        elif st == "cancelled": stats.cancelled += 1
        
        inv = db.query(Invoice).filter(Invoice.appointment_id == appt.id).first()
        if inv: stats.invoiced += 1
        
    result = []
    for bid in grouped:
        if bid is not None: result.append(grouped[bid])
    
    result.sort(key=lambda x: x["employee_name"])
    if grouped[None]["appointments"]: result.append(grouped[None])
    
    return result

@router.get("/check-conflict")
def check_appointment_conflict(
    barber_id: int,
    date: date,
    time: time,
    duration_minutes: int = 30,
    exclude_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    if isinstance(time, str):
        try:
            time = time.fromisoformat(time[:5])
        except Exception:
            pass

    new_start_dt = datetime.combine(date, time)
    new_end_dt = new_start_dt + timedelta(minutes=duration_minutes)

    query = db.query(Appointment).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date == date,
        Appointment.status.in_(ACTIVE_BOOKING_STATUSES),
    )
    if exclude_id:
        query = query.filter(Appointment.id != exclude_id)

    existing_appointments = query.all()
    for appt in existing_appointments:
        duration = appt.total_estimated_duration_minutes or 30
        exist_start_dt = datetime.combine(appt.appointment_date, appt.appointment_time)
        exist_end_dt = exist_start_dt + timedelta(minutes=duration)
        
        if new_start_dt < exist_end_dt and new_end_dt > exist_start_dt:
            barber = db.query(Employee).filter(Employee.id == barber_id).first()
            barber_name = barber.display_name if barber else "الخبير"
            return {
                "has_conflict": True, 
                "message": f"يوجد تضارب: الخبير {barber_name} لديه حجز آخر ({exist_start_dt.strftime('%H:%M')} - {exist_end_dt.strftime('%H:%M')})"
            }
    
    return {"has_conflict": False}

@router.get("/check-customer-duplicate")
def check_customer_duplicate(
    customer_id: int,
    date: date,
    exclude_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Appointment).filter(
        Appointment.customer_id == customer_id,
        Appointment.appointment_date == date,
        Appointment.status.in_(ACTIVE_BOOKING_STATUSES),
    )
    if exclude_id:
        query = query.filter(Appointment.id != exclude_id)
    
    duplicate = query.first()
    if duplicate:
        return {
            "has_duplicate": True, 
            "appointment_id": duplicate.id,
            "appointment_time": duplicate.appointment_time.strftime("%H:%M"),
            "message": f"هذا العميل لديه حجز آخر اليوم الساعة {duplicate.appointment_time.strftime('%H:%M')}"
        }
    return {"has_duplicate": False}

@router.get("/available-slots")
def get_available_slots(
    barber_id: int,
    date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    from app.services.scheduling_service import get_available_time_slots
    slots = get_available_time_slots(db, barber_id, date)
    return slots

@router.post("/cleanup-cancelled", status_code=status.HTTP_200_OK)
def manual_cleanup_cancelled(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    from app.services.cleanup_service import cleanup_old_cancelled_appointments
    deleted_count = cleanup_old_cancelled_appointments(db)
    return {"message": f"تم تنظيف قاعدة البيانات بنجاح. تم حذف {deleted_count} حجز ملغى قديم (أكثر من 30 يوم)."}

@router.post("/auto-cancel-expired")
def auto_cancel_expired_appointments(db: Session = Depends(get_db)):
    """Auto-cancel expired bookings:
    - Bookings from previous days with status pending/confirmed/waiting
    - Bookings today that are > 1 hour past scheduled time
    """
    from datetime import datetime, timedelta
    
    today = date.today()
    now = datetime.now()
    one_hour_ago = now - timedelta(hours=1)
    
    # Cancel previous days' bookings
    expired_previous = db.query(Appointment).filter(
        Appointment.appointment_date < today,
        Appointment.status.in_(["pending", "confirmed", "waiting"])
    ).all()
    
    # Cancel today's bookings that are > 1 hour late
    expired_today = db.query(Appointment).filter(
        Appointment.appointment_date == today,
        Appointment.status.in_(["pending", "confirmed"]),
        Appointment.appointment_time < one_hour_ago.strftime("%H:%M:%S")
    ).all()
    
    all_expired = expired_previous + expired_today
    count = 0
    
    for appt in all_expired:
        appt.status = "auto_cancelled"
        customer = db.query(Customer).filter(Customer.customer_id == appt.customer_id).first()
        if customer:
            current_count = getattr(customer, "cancellation_count", 0) or 0
            customer.cancellation_count = current_count + 1
        count += 1
    
    db.commit()
    return {"message": f"تم إلغاء {count} حجز متأخر تلقائياً", "cancelled_count": count}

@router.get("/{appointment_id}", response_model=AppointmentRead)
def get_appointment(appointment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    
    barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
    if current_user.role == "barber" and barber_id != appointment.barber_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذا الحجز")
    return _appointment_to_read(db, appointment)

# --- POST/PUT/PATCH/DELETE ENDPOINTS ---

@router.post("", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    if not db.query(Customer).filter(Customer.customer_id == payload.customer_id).first():
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    _ensure_existing_barber(db, payload.barber_id)
    _validate_future_datetime(payload.appointment_date, payload.appointment_time)
    
    # Calculate duration for overlap check
    total_duration = 0
    if payload.services:
        for s in payload.services:
            sid = s.serviceId if hasattr(s, "serviceId") else getattr(s, "service_id", None)
            service = db.query(Service).filter(Service.id == sid).first()
            if service:
                total_duration += (service.duration_minutes or 30) * (getattr(s, "quantity", 1) or 1)
    if total_duration == 0: total_duration = 30

    # Strict Operational Check: Block if outside shop hours
    is_within_hours = _is_within_shop_hours(db, payload.appointment_date, payload.appointment_time, total_duration)
    if not is_within_hours:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="عذراً، هذا الموعد خارج ساعات عمل المحل الرسمية. يرجى اختيار موعد آخر."
        )

    if not _ensure_available_slot(
        db,
        barber_id=payload.barber_id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        duration_minutes=total_duration,
    ):
        pass # _ensure_available_slot raises HTTPException on conflict

    appointment = Appointment(
        customer_id=payload.customer_id, 
        barber_id=payload.barber_id, 
        appointment_date=payload.appointment_date, 
        appointment_time=payload.appointment_time, 
        status="pending", 
        notes=payload.notes,
        booking_source=payload.booking_source or "shop",
        created_by_user_id=getattr(current_user, "id", None), 
        updated_by_user_id=getattr(current_user, "id", None)
    )
    db.add(appointment)
    db.flush()
    _rebuild_appointment_services(db, appointment, payload.services)
    db.commit()
    db.refresh(appointment)
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment.id).first()
    
    # Log the creation
    log_booking_change(
        db, 
        appointment.id, 
        getattr(current_user, "id", None), 
        "CREATE", 
        new_val={
            "customer_id": appointment.customer_id,
            "barber_id": appointment.barber_id,
            "date": str(appointment.appointment_date),
            "time": str(appointment.appointment_time),
            "status": appointment.status
        }
    )
    db.commit()

    return _appointment_to_read(db, appointment)

@router.post("/fast-walkin", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
def create_fast_walkin(payload: AppointmentFastWalkinCreate, db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    # Handle existing customer or create new one
    customer = None
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.customer_id == payload.customer_id).first()
    
    if not customer:
        if payload.phone:
            customer = db.query(Customer).filter(Customer.phone == payload.phone).first()
        if not customer:
            if not payload.first_name or not payload.phone:
                raise HTTPException(status_code=422, detail="يرجى توفير بيانات العميل (الاسم والهاتف) أو معرف العميل")
            customer = Customer(first_name=payload.first_name, phone=payload.phone)
            db.add(customer)
            db.flush()
    
    # Parse date and time
    if payload.appointment_date:
        try:
            appt_date = datetime.strptime(payload.appointment_date, "%Y-%m-%d").date()
        except ValueError:
            appt_date = date.today()
    else:
        appt_date = date.today()
    
    if payload.appointment_time:
        try:
            time_parts = payload.appointment_time.split(":")
            appt_time = time(int(time_parts[0]), int(time_parts[1]))
        except (ValueError, IndexError):
            appt_time = datetime.now().time()
    else:
        appt_time = datetime.now().time()
    
    # For fast walk-in, we still check availability if a barber is selected
    total_duration = 0
    if payload.service_ids:
        for sid in payload.service_ids:
            srv = db.query(Service).filter(Service.id == sid).first()
            if srv: total_duration += (srv.duration_minutes or 30)
    if total_duration == 0: total_duration = 30

    assigned_barber_id = payload.employee_id
    
    # Automatic distribution if no barber selected
    if not assigned_barber_id:
        # 1. Get present barbers (simple check, or all if presence logic not strictly enforced)
        present_barbers = db.query(Employee).filter(Employee.is_active == True).all()
        
        if not present_barbers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="لا يوجد خبراء متاحون في النظام حالياً"
            )
            
        # 2. Try to find one without conflict
        for b in present_barbers:
            try:
                _ensure_available_slot(
                    db,
                    barber_id=b.id,
                    appointment_date=appt_date,
                    appointment_time=appt_time,
                    duration_minutes=total_duration
                )
                assigned_barber_id = b.id
                break
            except HTTPException as e:
                if e.status_code in {400, 409}:
                    continue
                raise e
        
        # 3. Fallback: if all have conflicts, just pick the first one (waiting list logic)
        if not assigned_barber_id:
            assigned_barber_id = present_barbers[0].id

    elif assigned_barber_id:
        _ensure_available_slot(
            db,
            barber_id=assigned_barber_id,
            appointment_date=appt_date,
            appointment_time=appt_time,
            duration_minutes=total_duration
        )

    # Operational Check: Auto-cancel if outside shop hours (unlikely for fast walk-in now but for consistency)
    target_status, auto_note = _handle_shop_hours_and_status(db, appt_date, appt_time, total_duration, "waiting")

    appointment = Appointment(
        customer_id=customer.customer_id, 
        barber_id=assigned_barber_id, 
        appointment_date=appt_date, 
        appointment_time=appt_time, 
        status=target_status, 
        notes=(f"{payload.notes or ''}\n{auto_note}" if auto_note else payload.notes),
        booking_source=payload.booking_source or "shop",
        created_by_user_id=getattr(current_user, "id", None)
    )
    db.add(appointment)
    db.flush()
    
    if payload.service_ids:
        for sid in payload.service_ids:
            srv = db.query(Service).filter(Service.id == sid).first()
            if srv:
                db.add(AppointmentService(appointment_id=appointment.id, service_id=srv.id, service_name_snapshot=srv.name, price_snapshot=srv.price, duration_snapshot_minutes=getattr(srv, "duration_minutes", 30), quantity=1, is_active=True))
    
    db.commit()
    db.refresh(appointment)
    return _appointment_to_read(db, appointment)

@router.put("/{appointment_id}", response_model=AppointmentRead)
def update_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    appointment = _get_manageable_appointment(db, appointment_id)
    if not db.query(Customer).filter(Customer.customer_id == payload.customer_id).first():
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    _ensure_existing_barber(db, payload.barber_id)
    _validate_future_datetime(payload.appointment_date, payload.appointment_time)
    
    # Calculate duration
    total_duration = 0
    if payload.services:
        for s in payload.services:
            sid = s.serviceId if hasattr(s, "serviceId") else getattr(s, "service_id", None)
            service = db.query(Service).filter(Service.id == sid).first()
            if service:
                total_duration += (service.duration_minutes or 30) * (getattr(s, "quantity", 1) or 1)
    if total_duration == 0: total_duration = 30

    # Operational Check: Auto-cancel if outside shop hours
    target_status, auto_note = _handle_shop_hours_and_status(db, payload.appointment_date, payload.appointment_time, total_duration, appointment.status)

    if target_status != "cancelled":
        _ensure_available_slot(
            db,
            barber_id=payload.barber_id,
            appointment_date=payload.appointment_date,
            appointment_time=payload.appointment_time,
            duration_minutes=total_duration,
            exclude_appointment_id=appointment.id,
        )

    appointment.customer_id = payload.customer_id
    appointment.barber_id = payload.barber_id
    appointment.appointment_date = payload.appointment_date
    appointment.appointment_time = payload.appointment_time
    appointment.notes = (f"{payload.notes or ''}\n{auto_note}" if auto_note else payload.notes)
    appointment.status = target_status
    appointment.booking_source = payload.booking_source or appointment.booking_source
    appointment.updated_by_user_id = getattr(current_user, "id", None)
    _rebuild_appointment_services(db, appointment, payload.services)

    # Log the update
    old_state = {
        "customer_id": appointment.customer_id, # This is the new value already set
        "barber_id": appointment.barber_id,
        "date": str(appointment.appointment_date),
        "time": str(appointment.appointment_time),
        "status": appointment.status
    }
    # Note: Since we've already updated the object, we'd ideally need the state before the update.
    # To be accurate, we'll log the action "UPDATE" with the final state.
    log_booking_change(
        db,
        appointment.id,
        getattr(current_user, "id", None),
        "UPDATE",
        new_val=old_state
    )

    db.commit()
    db.refresh(appointment)
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment.id).first()
    return _appointment_to_read(db, appointment)

@router.patch("/{appointment_id}", response_model=AppointmentRead)
async def patch_appointment(
    appointment_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    appointment = _get_manageable_appointment(db, appointment_id)
    
    field_map = {
        "customerId": "customer_id",
        "employeeId": "barber_id",
        "appointmentDate": "appointment_date",
        "appointmentTime": "appointment_time",
        "notes": "notes",
        "status": "status",
        "bookingSource": "booking_source",
        "customer_id": "customer_id",
        "barber_id": "barber_id",
        "appointment_date": "appointment_date",
        "appointment_time": "appointment_time",
        "booking_source": "booking_source"
    }
    
    # Check for date/time/barber changes
    p_date = payload.get("appointmentDate") or payload.get("appointment_date")
    p_time = payload.get("appointmentTime") or payload.get("appointment_time")
    p_barber = payload.get("employeeId") or payload.get("barber_id")

    if p_date or p_time or p_barber or "services" in payload:
        new_date = p_date or appointment.appointment_date
        new_time = p_time or appointment.appointment_time
        new_barber = p_barber or appointment.barber_id
        
        if isinstance(new_date, str): new_date = date.fromisoformat(new_date)
        if isinstance(new_time, str): new_time = time.fromisoformat(new_time[:5])
        
        _validate_future_datetime(new_date, new_time)
        
        # Recalculate duration
        total_duration = appointment.total_estimated_duration_minutes or 30
        if "services" in payload:
            total_duration = 0
            for s in payload["services"]:
                sid = s.get("serviceId") or s.get("service_id")
                service = db.query(Service).filter(Service.id == sid).first()
                if service:
                    total_duration += (service.duration_minutes or 30) * (s.get("quantity", 1) or 1)
        
        # Operational Check: Auto-cancel if outside shop hours
        target_status, auto_note = _handle_shop_hours_and_status(db, new_date, new_time, total_duration, appointment.status)
        appointment.status = target_status
        if auto_note:
            appointment.notes = (f"{appointment.notes or ''}\n{auto_note}").strip()

        if appointment.status != "cancelled":
            _ensure_available_slot(
                db,
                barber_id=new_barber,
                appointment_date=new_date,
                appointment_time=new_time,
                duration_minutes=total_duration,
                exclude_appointment_id=appointment.id
            )

    for key, value in payload.items():
        if key in ("status", "services"): continue # handled separately
        db_key = field_map.get(key, key)
        # Avoid setting relationship attributes directly to prevent SQLAlchemy errors
        if db_key in ("customer", "barber", "services", "invoices", "sessions"):
            continue
        if hasattr(appointment, db_key):
            setattr(appointment, db_key, value)
            
    if "services" in payload:
        _rebuild_appointment_services(db, appointment, payload["services"])
        
    appointment.updated_by_user_id = getattr(current_user, "id", None)
    db.commit()
    db.refresh(appointment)
    return _appointment_to_read(db, appointment)

@router.patch("/{appointment_id}/status", response_model=AppointmentRead)
async def update_appointment_status(appointment_id: int, payload: AppointmentStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    
    barber_id = getattr(current_user, "barber_id", None) or getattr(current_user, "employee_id", None)
    if current_user.role == "barber" and barber_id != appointment.barber_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذا الحجز")
    
    old_status = appointment.status
    new_status = payload.status.lower()
    
    if new_status == "cancelled" and old_status != "cancelled":
        customer = db.query(Customer).filter(Customer.customer_id == appointment.customer_id).first()
        if customer:
            customer.cancellation_count += 1
            
            # Archive the cancellation in the history log
            from app.models.customer_cancellation_log import CustomerCancellationLog
            cancellation_log = CustomerCancellationLog(
                customer_id=customer.customer_id,
                appointment_id=appointment.id,
                reason=getattr(payload, "cancellation_reason", None) or (payload.get("cancellation_reason") if isinstance(payload, dict) else None),
                cancelled_by_user_id=current_user.id
            )
            db.add(cancellation_log)
            
        reason = getattr(payload, "cancellation_reason", None) or (payload.get("cancellation_reason") if isinstance(payload, dict) else None)
        if reason:
            appointment.cancellation_reason = reason

    appointment.status = new_status
    appointment.updated_by_user_id = getattr(current_user, "id", None)
    db.commit()
    db.refresh(appointment)
    
    await manager.broadcast({
        "event": "appointment_status_changed",
        "appointment_id": appointment.id,
        "status": new_status,
        "old_status": old_status
    })

    return _appointment_to_read(db, appointment)

@router.patch("/{appointment_id}/assign-barber", response_model=AppointmentRead)
async def assign_barber_to_appointment(
    appointment_id: int,
    payload: AppointmentAssignBarberPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    appointment = _get_manageable_appointment(db, appointment_id)
    _ensure_existing_barber(db, payload.employee_id)
    appointment.barber_id = payload.employee_id
    appointment.updated_by_user_id = getattr(current_user, "id", None)
    db.commit()
    db.refresh(appointment)
    return _appointment_to_read(db, appointment)

@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    appointment = _get_manageable_appointment(db, appointment_id)
    if appointment.invoices:
        raise HTTPException(
            status_code=400,
            detail="لا يمكن حذف الحجز بعد إصدار فاتورة عليه",
        )

    # We implement "Soft Delete" by changing status to cancelled
    appointment.status = "cancelled"
    appointment.cancellation_reason = "Deleted via API/UI"
    customer = db.query(Customer).filter(Customer.customer_id == appointment.customer_id).first()
    if customer:
        customer.cancellation_count += 1
    db.commit()

@router.post("/{appointment_id}/issue-invoice", response_model=IssueInvoiceResponse, status_code=status.HTTP_201_CREATED)
def issue_invoice_from_appointment(appointment_id: int, payment_method: str = "cash", db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    existing_invoice = db.query(Invoice).filter(Invoice.appointment_id == appointment_id).first()
    if existing_invoice:
        raise HTTPException(status_code=400, detail="تم إصدار فاتورة لهذا الحجز بالفعل")
    
    appointment_services = [item for item in (appointment.services or []) if item.is_active]
    if not appointment_services:
        raise HTTPException(status_code=400, detail="لا توجد خدمات فعالة داخل هذا الحجز لإصدار الفاتورة")
    
    allowed_payment_methods = {"cash", "card", "wallet", "transfer"}
    if payment_method not in allowed_payment_methods:
        raise HTTPException(status_code=400, detail="طريقة الدفع غير صحيحة")
        
    invoice_no = _generate_invoice_no(db)
    total_amount = Decimal("0.00")
    for item in appointment_services:
        qty = item.quantity or 1
        unit_price = Decimal(str(item.price_snapshot or 0))
        total_amount += unit_price * qty
        
    invoice = Invoice(invoice_no=invoice_no, appointment_id=appointment.id, customer_id=appointment.customer_id, barber_id=appointment.barber_id, payment_method=payment_method, total_amount=total_amount, created_by_user_id=getattr(current_user, "id", None))
    db.add(invoice)
    db.flush()
    
    invoice_items = []
    for item in appointment_services:
        qty = item.quantity or 1
        unit_price = Decimal(str(item.price_snapshot or 0))
        line_total = unit_price * qty
        invoice_items.append(InvoiceItem(invoice_id=invoice.id, service_id=item.service_id, service_name=item.service_name_snapshot, quantity=qty, unit_price=unit_price, total_price=line_total))
    db.add_all(invoice_items)
    
    customer = db.query(Customer).filter(Customer.customer_id == appointment.customer_id).first()
    barber = db.query(Employee).filter(Employee.id == appointment.barber_id).first()
    settings_row = db.query(BusinessSettings).first()
    
    pdf_path = generate_invoice_pdf(invoice=invoice, items=invoice_items, customer=customer, barber=barber, shop_name=settings_row.salon_name if settings_row else "SalonPro", shop_phone=settings_row.shop_phone if settings_row else None)
    invoice.pdf_path = pdf_path
    
    # Mark appointment as completed/done after invoice
    appointment.status = "done"
    
    session = db.query(ServiceSession).filter(ServiceSession.appointment_id == appointment.id).first()
    if session:
        session.status = "completed"
        db.add(session)
        
    if customer and customer.phone:
        customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or "عميلنا"
        upload_and_send_pdf(db, to_phone=customer.phone, pdf_path=pdf_path, filename=Path(pdf_path).name, caption=f"مرحبًا {customer_name}، مرفق فاتورتك رقم {invoice_no}", appointment_id=appointment.id, invoice_id=invoice.id, created_by_user_id=getattr(current_user, "id", None))
    
    deduct_stock_for_invoice(db, invoice_id=invoice.id, created_by_user_id=getattr(current_user, "id", None))
    
    db.commit()
    db.refresh(invoice)
    return IssueInvoiceResponse(message="تم إصدار الفاتورة بنجاح", invoice_id=invoice.id, invoice_no=invoice.invoice_no)
