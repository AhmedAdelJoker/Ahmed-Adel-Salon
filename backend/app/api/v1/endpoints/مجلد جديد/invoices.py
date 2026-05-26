from __future__ import annotations
from fastapi.middleware.cors import CORSMiddleware


import logging
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.models.invoice_adjustment_request import InvoiceAdjustmentRequest
from app.schemas.invoice_adjustment import (
    InvoiceAdjustmentRequestCreate,
    InvoiceAdjustmentRequestRead,
    InvoiceAdjustmentDecision
)
from app.api.deps import get_current_active_shift, require_cashier_manager_owner, require_owner_or_manager
from app.core.customer_names import compose_customer_name
from app.core.pos import (
    cashier_discount_limit,
    clamp_discount,
    is_payment_method_enabled,
    normalize_payment_method,
)
from app.db.session import SessionLocal, get_db
from app.models.business_settings import BusinessSettings
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.invoice_payment import InvoicePayment
from app.models.offer import Offer, OfferService
from app.models.pos_shift import PosShift
from app.models.user import User
from app.schemas.invoice import ManualInvoiceCreate
from app.services.activity_service import log_activity
from app.services.notification_service import notification_service
from app.services.invoice_builder import (
    apply_product_inventory_deductions,
    build_product_invoice_item,
    build_service_invoice_item,
)
from app.services.meta_whatsapp_service import (
    is_meta_whatsapp_configured,
    upload_and_send_pdf,
)
from app.services.pdf_service import generate_invoice_pdf

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/invoices", tags=["Invoices"])


class InvoiceUpdatePayload(BaseModel):
    payment_method: str | None = None
    discount_amount: Decimal | None = None
    discount_reason: str | None = None


def _settings_row(db: Session) -> BusinessSettings | None:
    return db.query(BusinessSettings).first()


def _generate_invoice_no(db: Session) -> str:
    prefix = "INV"
    date_str = datetime.now().strftime("%y%m%d")
    short_id = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_str}-{short_id}"


def build_offer_invoice_items(
    db: Session,
    *,
    offer_id: int | None,
    quantity: int | None = 1,
    employee_id: int | None = None,
) -> tuple[list[InvoiceItem], Decimal]:
    if not offer_id:
        raise HTTPException(status_code=400, detail="Offer id is required")

    qty = int(quantity or 1)
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Offer quantity must be greater than zero")

    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")

    if getattr(offer, "is_active", True) is False:
        raise HTTPException(status_code=400, detail="العرض غير نشط")

    today = date.today()
    if getattr(offer, "start_date", None) and offer.start_date > today:
        raise HTTPException(status_code=400, detail="العرض لم يبدأ بعد")
    if getattr(offer, "end_date", None) and offer.end_date < today:
        raise HTTPException(status_code=400, detail="العرض منتهي")

    offer_services = db.query(OfferService).filter(OfferService.offer_id == offer_id).all()
    if not offer_services:
        raise HTTPException(status_code=400, detail="العرض لا يحتوي على خدمات مرتبطة")

    unit_price = Decimal(str(offer.offer_price or 0))
    if unit_price < 0:
        unit_price = Decimal("0.00")

    line_total = unit_price * Decimal(qty)
    display_name = offer.name_ar or offer.name or f"عرض #{offer_id}"

    item = InvoiceItem(
        item_type="offer",
        service_id=None,
        product_id=None,
        employee_id=employee_id,
        service_name=display_name,
        quantity=qty,
        unit_price=unit_price,
        total_price=line_total,
        commission_amount=Decimal("0.00"),
    )

    if hasattr(item, "offer_id"):
        setattr(item, "offer_id", offer_id)

    return [item], line_total


def _get_open_shift_for_user(db: Session, user_id: int | None) -> PosShift | None:
    if not user_id:
        return None
    return (
        db.query(PosShift)
        .filter(PosShift.cashier_user_id == user_id, PosShift.status == "open")
        .order_by(PosShift.id.desc())
        .first()
    )


def _ensure_customer(db: Session, payload: ManualInvoiceCreate) -> Customer:
    if payload.customer_id is not None:
        customer = db.query(Customer).filter(Customer.customer_id == payload.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer

    # Fallback to phone search if provided
    if payload.customer_phone:
        customer = db.query(Customer).filter(Customer.phone == payload.customer_phone.strip()).first()
        if customer:
            if payload.customer_first_name:
                customer.first_name = payload.customer_first_name.strip()
            if payload.customer_last_name:
                customer.last_name = payload.customer_last_name.strip()
            db.add(customer)
            db.flush()
            return customer

    # Create new or use default walk-in
    first_name = (payload.customer_first_name or "عميل").strip()
    last_name = (payload.customer_last_name or "نقدي").strip()
    phone = (payload.customer_phone or "0000000000").strip()

    customer = Customer(
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        email=payload.customer_email,
    )
    db.add(customer)
    db.flush()
    return customer


def _serialize_invoice(invoice: Invoice, customer: Customer | None, employee: Employee | None):
    employee_name = None
    if employee:
        employee_name = getattr(employee, "display_name", None) or getattr(employee, "full_name", None)

    return {
        "id": invoice.id,
        "invoice_id": invoice.id,
        "invoice_no": invoice.invoice_no,
        "invoiceNo": invoice.invoice_no,
        "appointment_id": invoice.appointment_id,
        "customer_id": invoice.customer_id,
        "barber_id": invoice.employee_id,
        "employee_id": invoice.employee_id,
        "shift_id": invoice.shift_id,
        "customer_name": compose_customer_name(customer.first_name, customer.last_name) if customer else None,
        "barber_name": employee_name,
        "payment_method": invoice.payment_method,
        "subtotal_amount": float(invoice.subtotal_amount or 0),
        "discount_amount": float(invoice.discount_amount or 0),
        "discount_reason": invoice.discount_reason,
        "total_amount": float(invoice.total_amount or 0),
        "totalAmount": float(invoice.total_amount or 0),
        "pdf_path": invoice.pdf_path,
        "created_at": invoice.created_at,
        "items": [
            {
                "id": item.id,
                "item_type": item.item_type,
                "service_id": item.service_id,
                "product_id": item.product_id,
                "barber_id": item.employee_id,
                "employee_id": item.employee_id,
                "service_name": item.service_name,
                "barber_name": (getattr(item.employee, "display_name", None) or getattr(item.employee, "full_name", None)) if item.employee else None,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price or 0),
                "total_price": float(item.total_price or 0),
                "commission_amount": float(item.commission_amount or 0),
            }
            for item in (invoice.items or [])
        ],
        "payments": [
            {
                "id": p.id,
                "payment_method": p.payment_method,
                "amount": float(p.amount or 0),
                "reference_no": p.reference_no,
                "external_channel": p.external_channel,
                "received_at": p.received_at,
            }
            for p in (invoice.payments or [])
        ],
    }


def _apply_discount_or_raise(
    *,
    db: Session,
    invoice: Invoice,
    discount_amount: Decimal | None,
    discount_reason: str | None,
    current_user: User,
) -> None:
    if discount_amount is None:
        if discount_reason is not None:
            invoice.discount_reason = discount_reason
        return

    settings_row = _settings_row(db)
    subtotal_reference = Decimal(str(invoice.subtotal_amount or 0))
    if subtotal_reference <= 0:
        subtotal_reference = Decimal(str(invoice.total_amount or 0)) + Decimal(str(invoice.discount_amount or 0))

    invoice.subtotal_amount = subtotal_reference
    requested_discount = clamp_discount(subtotal_reference, Decimal(str(discount_amount or 0)))

    if current_user.role == "cashier":
        allowed = cashier_discount_limit(settings_row)
        if requested_discount > allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Discount exceeds cashier limit and needs manager approval",
            )

    invoice.discount_amount = requested_discount
    invoice.discount_reason = discount_reason
    invoice.total_amount = subtotal_reference - requested_discount
    invoice.final_amount = subtotal_reference - requested_discount

    if requested_discount > 0:
        invoice.discount_approved_by_user_id = getattr(current_user, "id", None)


def _ensure_invoice_pdf_path(db: Session, invoice: Invoice) -> Path | None:
    if invoice.pdf_path:
        path = Path(str(invoice.pdf_path))
        if path.exists():
            return path

    base_dir = Path(__file__).resolve().parents[4]
    expected_path = base_dir / "generated_invoices" / f"invoice_{invoice.invoice_no}.pdf"

    if expected_path.exists():
        invoice.pdf_path = str(expected_path)
        db.add(invoice)
        db.commit()
        return expected_path

    settings = db.query(BusinessSettings).first()
    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    employee = db.query(Employee).filter(Employee.id == invoice.employee_id).first()

    try:
        pdf_path_str = generate_invoice_pdf(
            invoice=invoice,
            items=items,
            customer=customer,
            barber=employee,
            settings=settings,
        )

        if isinstance(pdf_path_str, (tuple, list)):
            pdf_path_str = pdf_path_str[0] if pdf_path_str else None

        if not pdf_path_str:
            return None

        pdf_path = Path(str(pdf_path_str))
        if not pdf_path.exists():
            return None

        invoice.pdf_path = str(pdf_path)
        db.add(invoice)
        db.commit()
        return pdf_path

    except Exception as exc:
        logger.exception("PDF generation failed for invoice %s", invoice.id)
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed for invoice {invoice.id}: {exc}",
        ) from exc


def _generate_invoice_pdf_task(invoice_id: int, shop_name: str | None = None, shop_phone: str | None = None):
    db = SessionLocal()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            logger.error("Background task: invoice %s not found", invoice_id)
            return

        _ensure_invoice_pdf_path(db, invoice)
        logger.info("Background PDF task completed for invoice %s", invoice.invoice_no)
    except Exception as exc:
        logger.exception("Error generating PDF in background: %s", exc)
    finally:
        db.close()


def _end_of_day(value: date) -> datetime:
    return datetime.combine(value, time.max)


@router.get("")
def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
    skip: int = 0,
    limit: int = 50,
    page: int | None = None,
    page_size: int | None = None,
    q: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    if page is not None:
        effective_page_size = page_size or limit or 50
        limit = effective_page_size
        skip = max(page - 1, 0) * effective_page_size

    query = db.query(Invoice).options(joinedload(Invoice.items), joinedload(Invoice.payments))

    if q:
        query = query.filter(Invoice.invoice_no.ilike(f"%{q}%"))

    if start_date:
        query = query.filter(Invoice.created_at >= datetime.combine(start_date, time.min))

    if end_date:
        query = query.filter(Invoice.created_at <= _end_of_day(end_date))

    total = query.count()
    rows = query.order_by(Invoice.id.desc()).offset(skip).limit(limit).all()

    result = []
    for invoice in rows:
        customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
        employee = db.query(Employee).filter(Employee.id == invoice.employee_id).first()
        result.append(_serialize_invoice(invoice, customer, employee))

    return {"items": result, "total": total, "skip": skip, "limit": limit}



@router.get("/adjustment-requests/all", response_model=list[InvoiceAdjustmentRequestRead])
def list_adjustment_requests_static(
 db: Session = Depends(get_db),
 current_user: User = Depends(require_owner_or_manager),
 status: str | None = None,
):
 query = db.query(InvoiceAdjustmentRequest)
 if status:
  query = query.filter(InvoiceAdjustmentRequest.status == status)
 return query.order_by(InvoiceAdjustmentRequest.id.desc()).all()

@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.items), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")

    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    employee = db.query(Employee).filter(Employee.id == invoice.employee_id).first()
    return _serialize_invoice(invoice, customer, employee)


@router.post("/manual", status_code=status.HTTP_201_CREATED)
async def create_manual_invoice(
    payload: ManualInvoiceCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
    active_shift: PosShift = Depends(get_current_active_shift),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Invoice must include at least one item")

    settings_row = _settings_row(db)

    try:
        payment_method = normalize_payment_method(payload.payment_method)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid payment method") from exc

    if settings_row and not is_payment_method_enabled(settings_row, payment_method):
        raise HTTPException(status_code=400, detail="Payment method is disabled in business settings")

    open_shift = _get_open_shift_for_user(db, getattr(current_user, "id", None))
    if current_user.role == "cashier" and not open_shift:
        raise HTTPException(status_code=400, detail="Open a shift before creating invoices")

    customer = _ensure_customer(db, payload)

    if payload.appointment_id:
        from app.models.appointment import Appointment
        appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="الحجز المرتبط غير موجود")
        if appointment.customer_id != customer.customer_id:
            raise HTTPException(status_code=400, detail="الحجز لا ينتمي لهذا العميل")
        if appointment.status in ["completed", "cancelled", "no_show", "invoiced"]:
            raise HTTPException(status_code=409, detail="الحجز مكتمل أو ملغي بالفعل")
        existing_invoice = db.query(Invoice).filter(Invoice.appointment_id == payload.appointment_id).first()
        if existing_invoice:
            raise HTTPException(status_code=409, detail="تم إصدار فاتورة لهذا الحجز مسبقاً")

    subtotal = Decimal("0.00")
    invoice_items: list[InvoiceItem] = []
    item_employee_ids: set[int] = set()
    product_actions: list[tuple] = []

    payload_employee_id = getattr(payload, "employee_id", None) or getattr(payload, "barber_id", None)

    for entry in payload.items:
        item_type = entry.item_type or "service"

        if item_type == "product":
            item, line_total, inventory_action = build_product_invoice_item(
                db,
                product_id=entry.product_id,
                quantity=entry.quantity,
            )
            product_actions.append(inventory_action)
            subtotal += line_total
            invoice_items.append(item)
            continue

        emp_id = getattr(entry, "employee_id", None) or getattr(entry, "barber_id", None) or payload_employee_id

        if item_type == "offer":
            offer_items, offer_total = build_offer_invoice_items(
                db,
                offer_id=getattr(entry, "offer_id", None),
                quantity=entry.quantity,
                employee_id=emp_id,
            )
            subtotal += offer_total
            invoice_items.extend(offer_items)
            if emp_id is not None:
                item_employee_ids.add(emp_id)
            continue

        item, line_total, svc_prod_actions = build_service_invoice_item(
            db,
            service_id=entry.service_id,
            quantity=entry.quantity,
            employee_id=emp_id,
        )
        if svc_prod_actions:
            product_actions.extend(svc_prod_actions)
        if emp_id is not None:
            item_employee_ids.add(emp_id)
        subtotal += line_total
        invoice_items.append(item)

    requested_discount = clamp_discount(subtotal, payload.discount_amount)
    if current_user.role == "cashier" and requested_discount > cashier_discount_limit(settings_row):
        raise HTTPException(
            status_code=403,
            detail="Discount exceeds cashier limit. Create the invoice without discount, then request approval.",
        )

    primary_employee_id = None
    if len(item_employee_ids) == 1:
        primary_employee_id = next(iter(item_employee_ids))
    elif payload_employee_id is not None and len(item_employee_ids) == 0:
        primary_employee_id = payload_employee_id

    invoice = Invoice(
        invoice_no=_generate_invoice_no(db),
        customer_id=customer.customer_id,
        appointment_id=payload.appointment_id,
        employee_id=primary_employee_id,
        shift_id=active_shift.id,
        payment_method=payment_method,
        subtotal_amount=subtotal,
        discount_amount=requested_discount,
        discount_reason=payload.discount_reason,
        discount_approved_by_user_id=(getattr(current_user, "id", None) if requested_discount > 0 else None),
        total_amount=subtotal - requested_discount,
        final_amount=subtotal - requested_discount,
        created_by_user_id=getattr(current_user, "id", None),
    )
    db.add(invoice)
    db.flush()

    if payload.appointment_id:
        from app.models.appointment import Appointment
        db.query(Appointment).filter(Appointment.id == payload.appointment_id).update({"status": "invoiced", "employee_id": primary_employee_id})

    for item in invoice_items:
        item.invoice_id = invoice.id
    db.add_all(invoice_items)

    if product_actions:
        apply_product_inventory_deductions(
            db,
            product_actions=product_actions,
            created_by_user_id=getattr(current_user, "id", None),
            note=f"Manual invoice sale {invoice.invoice_no}",
        )

    # Handle Payments (Split or Single)
    if payload.split_payments:
        for sp in payload.split_payments:
            pm = normalize_payment_method(sp.payment_method)
            p_rec = InvoicePayment(
                invoice_id=invoice.id,
                payment_method=pm,
                amount=sp.amount,
                shift_id=active_shift.id,
                received_by_user_id=getattr(current_user, "id", None),
            )
            db.add(p_rec)
    else:
        payment = InvoicePayment(
            invoice_id=invoice.id,
            payment_method=payment_method,
            amount=invoice.total_amount,
            shift_id=active_shift.id,
            received_by_user_id=getattr(current_user, "id", None),
        )
        db.add(payment)
    
    db.flush()

    try:
        employee_for_pdf = db.query(Employee).filter(Employee.id == primary_employee_id).first() if primary_employee_id else None
        pdf_path = generate_invoice_pdf(
            invoice=invoice,
            items=invoice_items,
            customer=customer,
            barber=employee_for_pdf,
            settings=settings_row,
        )
        if isinstance(pdf_path, (tuple, list)):
            pdf_path = pdf_path[0] if pdf_path else None
        if pdf_path:
            invoice.pdf_path = str(pdf_path)
            db.add(invoice)
    except Exception:
        logger.exception("Immediate PDF generation failed for invoice %s", invoice.id)
        background_tasks.add_task(_generate_invoice_pdf_task, invoice_id=invoice.id)

    try:
        log_activity(
            db,
            user_id=getattr(current_user, "id", None),
            action="manual_invoice_created",
            entity_type="invoice",
            entity_id=invoice.id,
            description=f"Manual invoice {invoice.invoice_no} created with payment method {payment_method}",
        )
    except TypeError:
        log_activity(
            db,
            user_id=getattr(current_user, "id", None),
            action="manual_invoice_created",
            entity_type="invoice",
            entity_id=invoice.id,
            description=f"Manual invoice {invoice.invoice_no} created with payment method {payment_method}",
            old_values=None,
            new_values=None,
        )
    except Exception:
        logger.exception("Failed to write activity log for invoice %s", invoice.id)

    db.commit()
    db.refresh(invoice)

    # Trigger Notifications
    try:
        payload_notif = {
            "invoice_id": invoice.id,
            "invoice_no": invoice.invoice_no,
            "customer_name": f"{customer.first_name} {customer.last_name}",
            "amount": float(invoice.total_amount)
        }
        await notification_service.broadcast_event("invoice_created", payload_notif)
        await notification_service.notify_role(db, "manager", "invoice_created", f"تم إصدار فاتورة جديدة رقم {invoice.invoice_no}", payload_notif)
    except Exception:
        logger.exception("Failed to send manual invoice notifications")

    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.items), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice.id)
        .first()
    )
    employee = db.query(Employee).filter(Employee.id == invoice.employee_id).first()
    return _serialize_invoice(invoice, customer, employee)


@router.patch("/{invoice_id}")
async def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.items), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")

    if invoice.shift_id:
        shift = db.query(PosShift).filter(PosShift.id == invoice.shift_id).first()
        if shift and shift.status != "open":
            raise HTTPException(status_code=403, detail="لا يمكن تعديل عمليات وردية مغلقة ومؤرشفة")

    settings_row = _settings_row(db)
    old_values = {
        "payment_method": invoice.payment_method,
        "discount_amount": float(invoice.discount_amount or 0),
        "total_amount": float(invoice.total_amount or 0),
    }

    if payload.payment_method is not None:
        try:
            payment_method = normalize_payment_method(payload.payment_method)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid payment method") from exc
        if settings_row and not is_payment_method_enabled(settings_row, payment_method):
            raise HTTPException(status_code=400, detail="Payment method is disabled in business settings")
        invoice.payment_method = payment_method
        latest_payment = (invoice.payments or [])[-1] if invoice.payments else None
        if latest_payment:
            latest_payment.payment_method = payment_method
            db.add(latest_payment)

    _apply_discount_or_raise(
        db=db,
        invoice=invoice,
        discount_amount=payload.discount_amount,
        discount_reason=payload.discount_reason,
        current_user=current_user,
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    new_values = {
        "payment_method": invoice.payment_method,
        "discount_amount": float(invoice.discount_amount or 0),
        "total_amount": float(invoice.total_amount or 0),
    }

    try:
        log_activity(
            db,
            user_id=getattr(current_user, "id", None),
            action="update_invoice",
            entity_type="invoice",
            entity_id=invoice.id,
            description=f"Updated invoice {invoice.invoice_no} financial details",
            old_values=old_values,
            new_values=new_values,
        )
        db.commit()
    except Exception:
        logger.exception("Failed to write invoice update activity log")

    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    employee = db.query(Employee).filter(Employee.id == invoice.employee_id).first()
    return _serialize_invoice(invoice, customer, employee)


@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(
    invoice_id: int,
    inline: bool = Query(default=False),
    preview: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")

    file_path = _ensure_invoice_pdf_path(db, invoice)
    if not file_path:
        raise HTTPException(status_code=500, detail=f"لم يتم توليد أو العثور على ملف PDF للفاتورة #{invoice_id}")
    if not file_path.exists():
        raise HTTPException(status_code=500, detail=f"مسار PDF محفوظ لكنه غير موجود فعليًا: {file_path}")

    filename = file_path.name
    disposition = "inline" if inline else "attachment"
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )



@router.post("/{invoice_id}/regenerate-pdf")
def regenerate_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")

    invoice.pdf_path = None
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    file_path = _ensure_invoice_pdf_path(db, invoice)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=500, detail="تعذر إعادة توليد ملف PDF للفاتورة")

    return {
        "message": "تم إعادة توليد ملف PDF بنجاح",
        "invoice_id": invoice.id,
        "invoice_no": invoice.invoice_no,
        "pdf_path": str(file_path),
        "filename": file_path.name,
    }

@router.post("/{invoice_id}/send-whatsapp-pdf")
def send_invoice_pdf_to_whatsapp(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")

    file_path = _ensure_invoice_pdf_path(db, invoice)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="لا يوجد ملف PDF متاح لهذه الفاتورة")

    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    if not customer or not customer.phone:
        raise HTTPException(status_code=400, detail="رقم هاتف العميل غير موجود")

    if not is_meta_whatsapp_configured():
        raise HTTPException(status_code=503, detail="خدمة واتساب غير مهيئة")

    customer_name = compose_customer_name(customer.first_name, customer.last_name, fallback="Customer")
    filename = file_path.name
    caption = f"Hello {customer_name}, your invoice {invoice.invoice_no} is attached"

    try:
        upload_and_send_pdf(
            db,
            to_phone=customer.phone,
            pdf_path=str(file_path),
            filename=filename,
            caption=caption,
            appointment_id=invoice.appointment_id,
            invoice_id=invoice.id,
            created_by_user_id=getattr(current_user, "id", None),
        )
    except Exception as exc:
        try:
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    try:
        log_activity(
            db,
            user_id=getattr(current_user, "id", None),
            action="invoice_pdf_sent_whatsapp_meta",
            entity_type="invoice",
            entity_id=invoice.id,
            description=f"Invoice PDF {invoice.invoice_no} sent through Meta Cloud API",
        )
        db.commit()
    except Exception:
        logger.exception("Failed to write WhatsApp PDF activity log")

    return {"message": "Invoice PDF sent through WhatsApp successfully"}


@router.post("/{invoice_id}/adjustment-requests", response_model=InvoiceAdjustmentRequestRead)
def create_adjustment_request(
    invoice_id: int,
    payload: InvoiceAdjustmentRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    request = InvoiceAdjustmentRequest(
        invoice_id=invoice_id,
        requested_by_user_id=current_user.id,
        request_type=payload.request_type,
        reason=payload.reason,
        notes=payload.notes,
        old_values=payload.old_values,
        requested_values=payload.requested_values,
        status="pending"
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    
    try:
        log_activity(
            db,
            user_id=current_user.id,
            action="invoice_adjustment_requested",
            entity_type="invoice_adjustment_request",
            entity_id=request.id,
            description=f"Requested adjustment ({payload.request_type}) for invoice {invoice.invoice_no}",
            old_values=payload.old_values,
            new_values=payload.requested_values
        )
        db.commit()
    except Exception:
        logger.exception("Failed to write activity log for adjustment request")

    return request


@router.get("/adjustment-requests/all", response_model=list[InvoiceAdjustmentRequestRead])
def list_adjustment_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
    status: str | None = None
):
    query = db.query(InvoiceAdjustmentRequest)
    if status:
        query = query.filter(InvoiceAdjustmentRequest.status == status)
    return query.order_by(InvoiceAdjustmentRequest.id.desc()).all()


@router.post("/adjustment-requests/{request_id}/decision")
def review_adjustment_request(
    request_id: int,
    payload: InvoiceAdjustmentDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    request = db.query(InvoiceAdjustmentRequest).filter(InvoiceAdjustmentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    request.status = payload.status
    request.approved_by_user_id = current_user.id
    request.reviewed_at = datetime.now()
    if payload.decision_note:
        request.notes = (request.notes or "") + f"\nDecision: {payload.decision_note}"
    
    db.add(request)

    if payload.status == "approved":
        invoice = db.query(Invoice).filter(Invoice.id == request.invoice_id).first()
        if invoice:
            if request.request_type == "void":
                invoice.status = "cancelled"
            elif request.request_type == "payment_method" and request.requested_values:
                invoice.payment_method = request.requested_values.get("payment_method", invoice.payment_method)
            elif request.request_type == "discount" and request.requested_values:
                new_discount = request.requested_values.get("discount_amount")
                if new_discount is not None:
                    invoice.discount_amount = Decimal(str(new_discount))
                    invoice.total_amount = invoice.subtotal_amount - invoice.discount_amount
                    invoice.final_amount = invoice.total_amount
            
            db.add(invoice)
    
    try:
        log_activity(
            db,
            user_id=current_user.id,
            action=f"invoice_adjustment_{payload.status}",
            entity_type="invoice_adjustment_request",
            entity_id=request.id,
            description=f"Adjustment request {request_id} for invoice {request.invoice_id} was {payload.status}"
        )
        db.commit()
    except Exception:
        logger.exception("Failed to write activity log for adjustment decision")

    db.commit()
    return {"message": f"Request {payload.status} successfully"}



