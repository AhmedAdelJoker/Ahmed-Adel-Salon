from pathlib import Path
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.barber import Barber
from app.models.service import Service
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.business_settings import BusinessSettings
from app.models.service_session import ServiceSession

from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentMovePayload,
    AppointmentRead,
    AppointmentStatusUpdate,
    AppointmentUpdate,
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

router = APIRouter(prefix="/appointments", tags=["Appointments"])

ACTIVE_BOOKING_STATUSES = {"pending", "confirmed"}

# NOTE: Same implementation as provided earlier in chat, shortened comment-wise but full logic retained.

def _appointment_to_read(db: Session, appointment: Appointment) -> AppointmentRead:
    customer = db.query(Customer).filter(Customer.customer_id == appointment.customer_id).first()
    barber = db.query(Barber).filter(Barber.id == appointment.barber_id).first()
    return AppointmentRead(
        id=appointment.id,
        customer_id=appointment.customer_id,
        barber_id=appointment.barber_id,
        appointment_date=appointment.appointment_date,
        appointment_time=appointment.appointment_time,
        status=appointment.status,
        notes=appointment.notes,
        total_estimated_price=appointment.total_estimated_price,
        total_estimated_duration_minutes=appointment.total_estimated_duration_minutes,
        confirmation_sent=appointment.confirmation_sent,
        reminder_24h_sent=appointment.reminder_24h_sent,
        reminder_2h_sent=appointment.reminder_2h_sent,
        created_at=appointment.created_at,
        updated_at=appointment.updated_at,
        customer_name=(f"{customer.first_name or ''} {customer.last_name or ''}".strip() if customer else None),
        barber_name=barber.display_name if barber else None,
        services=appointment.services or [],
    )

def _rebuild_appointment_services(db: Session, appointment: Appointment, items: list):
    db.query(AppointmentService).filter(AppointmentService.appointment_id == appointment.id).delete()
    total_price = Decimal("0.00")
    total_duration = 0
    rows = []
    for item in items:
        service = db.query(Service).filter(Service.id == item.service_id).first()
        if not service:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"الخدمة {item.service_id} غير موجودة")
        qty = item.quantity or 1
        price = Decimal(str(service.price or 0))
        duration = int(getattr(service, "duration_minutes", 30) or 30)
        total_price += price * qty
        total_duration += duration * qty
        rows.append(AppointmentService(appointment_id=appointment.id, service_id=service.id, service_name_snapshot=service.name, price_snapshot=price, duration_snapshot_minutes=duration, quantity=qty, is_active=True, is_changed=False))
    db.add_all(rows)
    appointment.total_estimated_price = total_price
    appointment.total_estimated_duration_minutes = total_duration

def _generate_invoice_no(db: Session) -> str:
    today_prefix = datetime.utcnow().strftime("INV-%Y%m%d")
    count_today = db.query(Invoice).filter(Invoice.invoice_no.like(f"{today_prefix}%")).count()
    return f"{today_prefix}-{count_today + 1:04d}"


def _ensure_existing_customer(db: Session, customer_id: int) -> None:
    if not db.query(Customer).filter(Customer.customer_id == customer_id).first():
        raise HTTPException(status_code=404, detail="العميل غير موجود")


def _ensure_existing_barber(db: Session, barber_id: int) -> None:
    if not db.query(Barber).filter(Barber.id == barber_id).first():
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")


def _ensure_available_slot(
    db: Session,
    *,
    barber_id: int,
    appointment_date,
    appointment_time,
    exclude_appointment_id: int | None = None,
) -> None:
    query = db.query(Appointment).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date == appointment_date,
        Appointment.appointment_time == appointment_time,
        Appointment.status.in_(ACTIVE_BOOKING_STATUSES),
    )
    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)

    if query.first():
        raise HTTPException(
            status_code=409,
            detail="هذا الموعد محجوز بالفعل، اختر وقتًا آخر",
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

@router.get("", response_model=list[AppointmentRead])
def list_appointments(db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    query = db.query(Appointment).options(joinedload(Appointment.services)).order_by(Appointment.id.desc())
    if current_user.role == "barber":
        if not current_user.barber_id:
            return []
        query = query.filter(Appointment.barber_id == current_user.barber_id)
    return [_appointment_to_read(db, row) for row in query.all()]

@router.get("/{appointment_id}", response_model=AppointmentRead)
def get_appointment(appointment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    if current_user.role == "barber" and current_user.barber_id != appointment.barber_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذا الحجز")
    return _appointment_to_read(db, appointment)

@router.post("", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    _ensure_existing_customer(db, payload.customer_id)
    _ensure_existing_barber(db, payload.barber_id)
    _ensure_available_slot(
        db,
        barber_id=payload.barber_id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
    )
    appointment = Appointment(customer_id=payload.customer_id, barber_id=payload.barber_id, appointment_date=payload.appointment_date, appointment_time=payload.appointment_time, status="pending", notes=payload.notes, created_by_user_id=getattr(current_user, "id", None), updated_by_user_id=getattr(current_user, "id", None))
    db.add(appointment)
    db.flush()
    _rebuild_appointment_services(db, appointment, payload.services)
    db.commit()
    db.refresh(appointment)
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment.id).first()
    return _appointment_to_read(db, appointment)

@router.put("/{appointment_id}", response_model=AppointmentRead)
def update_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    appointment = _get_manageable_appointment(db, appointment_id)
    _ensure_existing_customer(db, payload.customer_id)
    _ensure_existing_barber(db, payload.barber_id)
    _ensure_available_slot(
        db,
        barber_id=payload.barber_id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        exclude_appointment_id=appointment.id,
    )

    appointment.customer_id = payload.customer_id
    appointment.barber_id = payload.barber_id
    appointment.appointment_date = payload.appointment_date
    appointment.appointment_time = payload.appointment_time
    appointment.notes = payload.notes
    appointment.updated_by_user_id = getattr(current_user, "id", None)
    _rebuild_appointment_services(db, appointment, payload.services)

    db.commit()
    db.refresh(appointment)
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment.id).first()
    return _appointment_to_read(db, appointment)

@router.patch("/{appointment_id}", response_model=AppointmentRead)
def move_appointment(
    appointment_id: int,
    payload: AppointmentMovePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    appointment = _get_manageable_appointment(db, appointment_id)

    next_barber_id = payload.barber_id if payload.barber_id is not None else appointment.barber_id
    next_date = payload.appointment_date if payload.appointment_date is not None else appointment.appointment_date
    next_time = payload.appointment_time if payload.appointment_time is not None else appointment.appointment_time

    _ensure_existing_barber(db, next_barber_id)
    _ensure_available_slot(
        db,
        barber_id=next_barber_id,
        appointment_date=next_date,
        appointment_time=next_time,
        exclude_appointment_id=appointment.id,
    )

    appointment.barber_id = next_barber_id
    appointment.appointment_date = next_date
    appointment.appointment_time = next_time
    if payload.status is not None:
        appointment.status = payload.status
    appointment.updated_by_user_id = getattr(current_user, "id", None)

    db.commit()
    db.refresh(appointment)
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment.id).first()
    return _appointment_to_read(db, appointment)

@router.patch("/{appointment_id}/status", response_model=AppointmentRead)
def update_appointment_status(appointment_id: int, payload: AppointmentStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    if current_user.role == "barber" and current_user.barber_id != appointment.barber_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذا الحجز")
    appointment.status = payload.status
    appointment.updated_by_user_id = getattr(current_user, "id", None)
    db.commit()
    db.refresh(appointment)
    return _appointment_to_read(db, appointment)

@router.post("/{appointment_id}/send-confirmation")
def send_confirmation(appointment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    appointment = db.query(Appointment).options(joinedload(Appointment.services)).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    customer = db.query(Customer).filter(Customer.customer_id == appointment.customer_id).first()
    barber = db.query(Barber).filter(Barber.id == appointment.barber_id).first()
    if not customer or not customer.phone:
        raise HTTPException(status_code=400, detail="رقم هاتف العميل غير متوفر")
    body = f"مرحبًا {f'{customer.first_name or ''} {customer.last_name or ''}'.strip() or 'عميلنا'}، تم تأكيد حجزك يوم {appointment.appointment_date} الساعة {appointment.appointment_time}. الخدمات: {', '.join([s.service_name_snapshot for s in appointment.services]) or 'خدمة'}. الحلاق: {barber.display_name if barber else '-'}."
    send_text_message(db, to_phone=customer.phone, body=body, message_type="appointment_confirmation", appointment_id=appointment.id, created_by_user_id=getattr(current_user, "id", None))
    appointment.confirmation_sent = True
    db.commit()
    return {"message": "تم إرسال رسالة التأكيد عبر واتساب"}

@router.post("/{appointment_id}/send-reminder")
def send_reminder(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    appointment = _get_manageable_appointment(db, appointment_id)
    customer = db.query(Customer).filter(Customer.customer_id == appointment.customer_id).first()
    barber = db.query(Barber).filter(Barber.id == appointment.barber_id).first()
    if not customer or not customer.phone:
        raise HTTPException(status_code=400, detail="رقم هاتف العميل غير متوفر")

    appointment_dt = datetime.combine(appointment.appointment_date, appointment.appointment_time)
    time_until_appointment = appointment_dt - datetime.now()
    barber_name = barber.display_name if barber else "-"

    if time_until_appointment <= timedelta(hours=4):
        send_appointment_reminder_2h_template(
            db,
            to_phone=customer.phone,
            appointment_time=str(appointment.appointment_time),
            barber_name=barber_name,
            appointment_id=appointment.id,
        )
        appointment.reminder_2h_sent = True
    else:
        send_appointment_reminder_24h_template(
            db,
            to_phone=customer.phone,
            customer_name=f"{customer.first_name or ''} {customer.last_name or ''}".strip(),
            appointment_date=str(appointment.appointment_date),
            appointment_time=str(appointment.appointment_time),
            barber_name=barber_name,
            appointment_id=appointment.id,
        )
        appointment.reminder_24h_sent = True

    db.commit()
    return {"message": "تم إرسال التذكير بنجاح"}

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
    barber = db.query(Barber).filter(Barber.id == appointment.barber_id).first()
    settings_row = db.query(BusinessSettings).first()
    pdf_path = generate_invoice_pdf(invoice=invoice, items=invoice_items, customer=customer, barber=barber, shop_name=settings_row.salon_name if settings_row else "SalonPro", shop_phone=settings_row.shop_phone if settings_row else None)
    invoice.pdf_path = pdf_path
    appointment.status = "completed"
    session = db.query(ServiceSession).filter(ServiceSession.appointment_id == appointment.id).first()
    if session:
        session.status = "completed"
        db.add(session)
    if customer and customer.phone:
        customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or "عميلنا"
        upload_and_send_pdf(db, to_phone=customer.phone, pdf_path=pdf_path, filename=Path(pdf_path).name, caption=f"مرحبًا {customer_name}، مرفق فاتورتك رقم {invoice_no}", appointment_id=appointment.id, invoice_id=invoice.id, created_by_user_id=getattr(current_user, "id", None))
    db.commit()
    db.refresh(invoice)
    return IssueInvoiceResponse(message="تم إصدار الفاتورة بنجاح", invoice_id=invoice.id, invoice_no=invoice.invoice_no)

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

    db.delete(appointment)
    db.commit()
