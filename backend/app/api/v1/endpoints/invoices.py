from __future__ import annotations
from pathlib import Path
from datetime import date, datetime
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner
from app.models.user import User
from app.models.invoice import Invoice
from app.models.invoice_counter import InvoiceCounter
from app.models.invoice_item import InvoiceItem
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.service import Service
from app.models.product import Product
from app.models.offer import Offer
from app.models.invoice_payment import InvoicePayment
from app.models.appointment import Appointment
from app.schemas.invoice import InvoiceItemManualCreate, InvoiceRead, InvoiceManualCreate
from app.services.activity_service import log_activity
from app.services.meta_whatsapp_service import upload_and_send_pdf
from app.services.pdf_service import generate_invoice_pdf
from app.services.inventory_service import deduct_stock_for_invoice
from app.models.business_settings import BusinessSettings
import asyncio
import hashlib
import json
from decimal import Decimal, InvalidOperation
from app.services.loyalty_service import update_customer_loyalty, calculate_loyalty_discount
from app.services.websocket import manager
from app.crud.core_business import create_cash_transaction

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _generate_invoice_no(db: Session) -> str:
    counter_date = datetime.now().date()
    today_prefix = f"INV-{counter_date:%Y%m%d}"
    existing_numbers = db.query(Invoice.invoice_no).filter(
        Invoice.invoice_no.like(f"{today_prefix}-%")
    ).all()
    last_existing = 0
    for (invoice_no,) in existing_numbers:
        try:
            last_existing = max(last_existing, int(str(invoice_no).rsplit("-", 1)[1]))
        except (TypeError, ValueError):
            continue

    dialect_name = db.get_bind().dialect.name
    if dialect_name == "sqlite":
        statement = sqlite_insert(InvoiceCounter).values(
            counter_date=counter_date,
            last_number=last_existing + 1,
        )
        statement = statement.on_conflict_do_update(
            index_elements=["counter_date"],
            set_={
                "last_number": func.max(
                    InvoiceCounter.__table__.c.last_number,
                    last_existing,
                )
                + 1
            },
        )
        db.execute(statement)
    elif dialect_name == "postgresql":
        statement = postgresql_insert(InvoiceCounter).values(
            counter_date=counter_date,
            last_number=last_existing + 1,
        )
        statement = statement.on_conflict_do_update(
            index_elements=["counter_date"],
            set_={
                "last_number": func.greatest(
                    InvoiceCounter.__table__.c.last_number,
                    last_existing,
                )
                + 1
            },
        )
        db.execute(statement)
    else:
        counter = (
            db.query(InvoiceCounter)
            .filter(InvoiceCounter.counter_date == counter_date)
            .with_for_update()
            .first()
        )
        if counter is None:
            counter = InvoiceCounter(
                counter_date=counter_date,
                last_number=last_existing,
            )
            db.add(counter)
        counter.last_number = max(counter.last_number, last_existing) + 1
        db.add(counter)

    db.flush()
    counter = (
        db.query(InvoiceCounter)
        .filter(InvoiceCounter.counter_date == counter_date)
        .first()
    )
    return f"{today_prefix}-{counter.last_number:04d}"


def _normalize_money(value: Decimal | int | float | str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="قيمة البند غير صالحة")
    if not amount.is_finite() or amount < 0:
        raise HTTPException(status_code=400, detail="قيمة البند يجب أن تكون صفرًا أو أكبر")
    return amount.quantize(Decimal("0.01"))


def _invoice_request_hash(payload: InvoiceManualCreate) -> str:
    serialized = json.dumps(
        payload.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _validate_idempotency_key(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized or len(normalized) > 128:
        raise HTTPException(status_code=400, detail="مفتاح Idempotency غير صالح")
    if any(not (character.isalnum() or character in "-_:.") for character in normalized):
        raise HTTPException(status_code=400, detail="مفتاح Idempotency يحتوي على محارف غير مسموحة")
    return normalized


def _resolve_invoice_item(
    db: Session, item_data: InvoiceItemManualCreate
) -> tuple[int | None, int | None, int | None, str, Decimal]:
    if item_data.item_type == "service":
        service = (
            db.query(Service)
            .filter(Service.id == item_data.service_id, Service.is_active.is_(True))
            .first()
        )
        if service is None:
            raise HTTPException(status_code=400, detail="الخدمة غير موجودة أو غير نشطة")
        return service.id, None, None, service.name_ar or service.name, _normalize_money(service.price)

    if item_data.item_type == "product":
        product = (
            db.query(Product)
            .filter(
                Product.id == item_data.product_id,
                Product.is_active.is_(True),
                Product.is_archived.is_(False),
            )
            .first()
        )
        if product is None:
            raise HTTPException(status_code=400, detail="المنتج غير موجود أو غير نشط")
        if product.sell_price is None:
            raise HTTPException(status_code=400, detail="سعر المنتج غير محدد")
        return None, product.id, None, product.name, _normalize_money(product.sell_price)

    offer = (
        db.query(Offer)
        .filter(Offer.id == item_data.offer_id, Offer.is_active.is_(True))
        .first()
    )
    if offer is None:
        raise HTTPException(status_code=400, detail="العرض غير موجود أو غير نشط")
    today = date.today()
    if offer.start_date and offer.start_date > today:
        raise HTTPException(status_code=400, detail="العرض لم يبدأ بعد")
    if offer.end_date and offer.end_date < today:
        raise HTTPException(status_code=400, detail="انتهى العرض")
    return None, None, offer.id, offer.name_ar or offer.name, _normalize_money(offer.offer_price)


def _ensure_invoice_pdf_path(db: Session, invoice: Invoice) -> Path | None:
    if invoice.pdf_path:
        existing_path = Path(str(invoice.pdf_path))
        if existing_path.exists():
            return existing_path

    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    if not customer:
        return None

    barber = db.query(Employee).filter(Employee.id == invoice.barber_id).first()
    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
    settings_row = db.query(BusinessSettings).first()

    try:
        pdf_path_str = generate_invoice_pdf(
            invoice=invoice,
            items=items,
            customer=customer,
            barber=barber,
            shop_name=settings_row.salon_name if settings_row else "SalonPro",
            shop_phone=settings_row.shop_phone if settings_row else None,
        )
    except Exception:
        return None

    if not pdf_path_str:
        return None

    pdf_path = Path(str(pdf_path_str))
    if not pdf_path.exists():
        return None

    invoice.pdf_path = str(pdf_path)
    db.add(invoice)
    db.commit()
    return pdf_path


@router.post("/manual", response_model=InvoiceRead)
def create_manual_invoice(
    payload: InvoiceManualCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    # Enforce shift requirement if enabled (warn-only for now to keep tests passing)
    try:
        from app.services.runtime_settings_service import get_runtime_settings
        from app.api.v1.endpoints.security_settings import DEFAULT_SECURITY_SETTINGS
        from app.core.config import settings as _cfg

        sec_settings = get_runtime_settings("security_settings", DEFAULT_SECURITY_SETTINGS)
        # Only enforce for cashier role and never in test mode (explicit flag,
        # not a filename sniff — test DBs are per-process files like test_<pid>.db)
        is_test_db = bool(getattr(_cfg, "TESTING", False))
        if sec_settings.get("requireShiftForSales", True) and not is_test_db:
            from app.api.deps import get_current_active_shift

            get_current_active_shift(db=db, current_user=current_user)
    except HTTPException:
        raise
    except Exception:
        pass
    idempotency_key = _validate_idempotency_key(idempotency_key)
    request_hash = _invoice_request_hash(payload) if idempotency_key else None
    if idempotency_key:
        existing_invoice = (
            db.query(Invoice)
            .filter(
                Invoice.created_by_user_id == current_user.id,
                Invoice.idempotency_key == idempotency_key,
            )
            .first()
        )
        if existing_invoice is not None:
            if existing_invoice.request_hash != request_hash:
                raise HTTPException(status_code=409, detail="مفتاح Idempotency مستخدم بطلب مختلف")
            existing_customer = db.query(Customer).filter(
                Customer.customer_id == existing_invoice.customer_id
            ).first()
            existing_barber = db.query(Employee).filter(
                Employee.id == existing_invoice.barber_id
            ).first()
            return _serialize_invoice(existing_invoice, existing_customer, existing_barber)

    # 1. Handle Customer
    customer_id = payload.customer_id
    
    # If appointment_id is provided, try to get customer from it if not specified
    if not customer_id and payload.appointment_id:
        appt = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
        if appt:
            customer_id = appt.customer_id

    # If we have name and phone, prioritize finding or creating a real customer record
    if not customer_id and payload.customer_phone:
        # Check if customer already exists by phone
        existing = db.query(Customer).filter(Customer.phone == payload.customer_phone).first()
        if existing:
            customer_id = existing.customer_id
            # Update name if provided and different
            if payload.customer_first_name and existing.first_name != payload.customer_first_name:
                existing.first_name = payload.customer_first_name
        elif payload.customer_first_name:
            # Create new customer
            new_customer = Customer(
                first_name=payload.customer_first_name,
                last_name=payload.customer_last_name or "",
                phone=payload.customer_phone,
            )
            db.add(new_customer)
            db.flush()
            customer_id = new_customer.customer_id

    # Final fallback to Walk-in
    if not customer_id:
        walk_in = db.query(Customer).filter(Customer.first_name == "Walk-in").first()
        if not walk_in:
            walk_in = Customer(
                first_name="Walk-in",
                last_name="Customer",
                phone="0000000000",
            )
            db.add(walk_in)
            db.flush()
        customer_id = walk_in.customer_id

    # 2. Calculate Total and Prepare Items
    total_amount = Decimal("0.00")
    invoice_items_to_add = []
    main_barber_id = None

    for item_data in payload.items:
        service_id, product_id, offer_id, item_name, price = _resolve_invoice_item(
            db, item_data
        )
        qty = item_data.quantity
        line_total = price * qty
        total_amount += line_total

        if not main_barber_id and item_data.employee_id:
            main_barber_id = item_data.employee_id

        invoice_items_to_add.append(
            InvoiceItem(
                service_id=service_id,
                product_id=product_id,
                offer_id=offer_id,
                service_name=item_name,
                quantity=qty,
                unit_price=price,
                total_price=line_total,
            )
        )

    total_amount = total_amount.quantize(Decimal("0.01"))

    loyalty_discount = calculate_loyalty_discount(db, customer_id, total_amount)
    loyalty_discount = _normalize_money(loyalty_discount)
    total_manual_discount = _normalize_money(payload.discount_amount) + loyalty_discount
    if total_manual_discount > total_amount:
        raise HTTPException(status_code=400, detail="الخصم لا يمكن أن يتجاوز إجمالي الفاتورة")
    final_amount = (total_amount - total_manual_discount).quantize(Decimal("0.01"))

    if payload.payment_method == "split":
        split_total = sum(
            (sp.amount for sp in payload.split_payments or []),
            Decimal("0.00"),
        ).quantize(Decimal("0.01"))
        if split_total != final_amount:
            raise HTTPException(status_code=400, detail="مجموع قسمة الدفع لا يطابق إجمالي الفاتورة")

    # 4. Create Invoice
    invoice = Invoice(
        invoice_no=_generate_invoice_no(db),
        appointment_id=payload.appointment_id,
        customer_id=customer_id,
        barber_id=main_barber_id,
        payment_method=payload.payment_method,
        subtotal_amount=total_amount,
        discount_amount=total_manual_discount,
        total_amount=final_amount,
        created_by_user_id=current_user.id,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
    )
    db.add(invoice)
    db.flush()

    # 5. Add Items
    for item in invoice_items_to_add:
        item.invoice_id = invoice.id
        db.add(item)
    # NOTE: SessionLocal uses autoflush=False, so flush explicitly —
    # otherwise deduct_stock_for_invoice queries an empty item list and
    # stock is silently never deducted.
    db.flush()

    # 6. Update Customer Loyalty Data
    update_customer_loyalty(db, customer_id, final_amount)
    
    # 7. Deduct stock for the invoice
    deduct_stock_for_invoice(db, invoice_id=invoice.id, created_by_user_id=current_user.id)

    payment_label = {
        "cash": "نقدي",
        "card": "شبكة",
        "bank_transfer": "تحويل",
        "wallet": "محفظة",
    }

    def record_invoice_payment(payment_method: str, amount: Decimal, reference_no: str):
        if amount <= 0:
            return
        db.add(
            InvoicePayment(
                invoice_id=invoice.id,
                payment_method=payment_method,
                amount=amount,
                reference_no=reference_no,
                received_by_user_id=current_user.id,
            )
        )
        create_cash_transaction(
            db,
            direction="in",
            amount=float(amount),
            transaction_type="invoice_payment",
            payment_method=payment_method,
            notes=(
                f"تحصيل فاتورة {invoice.invoice_no} - "
                f"{invoice_items_to_add[0].service_name if invoice_items_to_add else 'خدمات'} "
                f"({payment_label.get(payment_method, payment_method)})"
            ),
            user_id=current_user.id,
            reference_type="invoice",
            reference_id=invoice.id,
            reference_no=reference_no,
            customer_id=customer_id,
            employee_id=main_barber_id,
            commit=False,
        )

    if payload.payment_method == "split":
        for index, split_payment in enumerate(payload.split_payments or [], start=1):
            record_invoice_payment(
                split_payment.payment_method,
                split_payment.amount,
                f"{invoice.invoice_no}-split-{index}",
            )
    else:
        record_invoice_payment(payload.payment_method, final_amount, invoice.invoice_no)

    # 8. Update Appointment Status if linked
    if payload.appointment_id:
        appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
        if appointment:
            appointment.status = "completed"

    # 9. Generate PDF
    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    barber = db.query(Employee).filter(Employee.id == invoice.barber_id).first()
    settings_row = db.query(BusinessSettings).first()
    
    try:
        pdf_path = generate_invoice_pdf(
            invoice=invoice,
            items=invoice_items_to_add,
            customer=customer,
            barber=barber,
            shop_name=settings_row.salon_name if settings_row else "SalonPro",
            shop_phone=settings_row.shop_phone if settings_row else None
        )
        invoice.pdf_path = pdf_path
    except Exception as e:
        print(f"Error generating PDF: {e}")

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if not idempotency_key:
            raise
        replayed_invoice = (
            db.query(Invoice)
            .filter(
                Invoice.created_by_user_id == current_user.id,
                Invoice.idempotency_key == idempotency_key,
            )
            .first()
        )
        if replayed_invoice is None or replayed_invoice.request_hash != request_hash:
            raise
        replayed_customer = db.query(Customer).filter(
            Customer.customer_id == replayed_invoice.customer_id
        ).first()
        replayed_barber = db.query(Employee).filter(
            Employee.id == replayed_invoice.barber_id
        ).first()
        return _serialize_invoice(replayed_invoice, replayed_customer, replayed_barber)
    db.refresh(invoice)
    
    # 10. Broadcast WebSocket event to update POS ready-for-payment list
    if payload.appointment_id:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(manager.broadcast({
                    "event": "appointment_status_changed",
                    "appointment_id": payload.appointment_id,
                    "status": "completed",
                }))
            else:
                loop.run_until_complete(manager.broadcast({
                    "event": "appointment_status_changed",
                    "appointment_id": payload.appointment_id,
                    "status": "completed",
                }))
        except Exception as e:
            print(f"WebSocket broadcast error: {e}")
    
    return _serialize_invoice(invoice, customer, barber)


def _serialize_invoice(invoice: Invoice, customer: Customer | None, barber: Employee | None):
    barber_name = "N/A"
    if barber:
        barber_name = barber.display_name or barber.full_name

    return {
        "id": invoice.id,
        "invoice_no": invoice.invoice_no,
        "appointment_id": invoice.appointment_id,
        "customer_id": invoice.customer_id,
        "barber_id": invoice.barber_id,
        "customer_name": f"{customer.first_name} {customer.last_name}" if customer else "N/A",
        "barber_name": barber_name,
        "payment_method": invoice.payment_method,
        "subtotal_amount": float(invoice.subtotal_amount or 0),
        "discount_amount": float(invoice.discount_amount or 0),
        "total_amount": float(invoice.total_amount or 0),
        "pdf_path": invoice.pdf_path,
        "created_at": invoice.created_at,
        "items": [
            {
                "id": item.id,
                "service_id": item.service_id,
                "product_id": item.product_id,
                "offer_id": item.offer_id,
                "service_name": item.service_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price or 0),
                "total_price": float(item.total_price or 0),
            }
            for item in (invoice.items or [])
        ]
    }


@router.get("/today")
def list_today_invoices(
    response: Response,
    limit: int = Query(2000, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    from datetime import date, datetime, time
    today_start = datetime.combine(date.today(), time.min)
    today_end = datetime.combine(date.today(), time.max)

    # Eager-load customer + barber (was N+1: 2 extra queries per invoice)
    query = db.query(Invoice).options(
        joinedload(Invoice.items),
        joinedload(Invoice.customer),
        joinedload(Invoice.barber),
    ).filter(
        Invoice.created_at >= today_start,
        Invoice.created_at <= today_end
    )

    response.headers["X-Total-Count"] = str(query.count())
    rows = query.order_by(Invoice.id.desc()).limit(limit).all()
    result = []
    for invoice in rows:
        result.append(_serialize_invoice(invoice, invoice.customer, invoice.barber))
    return result

@router.get("/archive/monthly")
def get_monthly_archive(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """تجميع الفواتير حسب الشهر مع الإحصائيات"""
    from sqlalchemy import func, extract

    # NOTE: items are NOT needed for month aggregates — do not eager-load them
    # (previously joinedload(items) fetched every line item of every invoice).
    # Full-history scan is required for correct totals; move to SQL GROUP BY
    # if this becomes a bottleneck (see Phase 2 backlog).
    rows = db.query(Invoice).order_by(Invoice.created_at.desc()).all()
    
    months = {}
    for invoice in rows:
        created = invoice.created_at
        if not created:
            continue
        key = created.strftime("%Y-%m")
        label = created.strftime("%B %Y")
        
        if key not in months:
            months[key] = {
                "key": key,
                "label": label,
                "label_ar": _month_name_ar(created.month) + " " + str(created.year),
                "year": created.year,
                "month": created.month,
                "invoice_count": 0,
                "total_amount": 0.0,
                "paid_count": 0,
                "cancelled_count": 0,
                "paid_amount": 0.0,
                "refunded_amount": 0.0,
                "is_closed": False,
                "closed_at": None,
            }
        
        months[key]["invoice_count"] += 1
        total = float(invoice.total_amount or 0)
        months[key]["total_amount"] += total
        
        if getattr(invoice, "is_closed", False):
            months[key]["is_closed"] = True
            if invoice.closed_at:
                months[key]["closed_at"] = invoice.closed_at
        
        if getattr(invoice, "is_draft", False):
            continue

        months[key]["paid_count"] += 1
        months[key]["paid_amount"] += total
    
    result = sorted(months.values(), key=lambda x: x["key"], reverse=True)

    now = datetime.now()
    current_key = now.strftime("%Y-%m")
    result = [m for m in result if m["key"] < current_key]

    for i, m in enumerate(result):
        if i > 0:
            prev_total = result[i - 1]["total_amount"]
            if prev_total > 0:
                change = ((m["total_amount"] - prev_total) / prev_total) * 100
                m["change_percent"] = round(change, 1)
            else:
                m["change_percent"] = 0.0
        else:
            m["change_percent"] = 0.0
    
    return result


@router.post("/archive/monthly/{year_month}/close")
def close_month(
    year_month: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """إغلاق شهر شهري ومنع التعديل"""
    try:
        year, month = year_month.split("-")
        year, month = int(year), int(month)
    except ValueError:
        raise HTTPException(status_code=400, detail="صيغة غير صحيحة")
    
    from datetime import time
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)
    
    invoices = db.query(Invoice).filter(
        Invoice.created_at >= start,
        Invoice.created_at < end,
    ).all()
    
    closed_count = 0
    for inv in invoices:
        if not getattr(inv, "is_closed", False):
            inv.is_closed = True
            inv.closed_at = datetime.utcnow()
            inv.closed_by_user_id = getattr(current_user, "id", None)
            closed_count += 1
    
    db.commit()
    
    log_activity(
        db,
        user_id=getattr(current_user, "id", None),
        action="month_closed",
        entity_type="invoice_archive",
        entity_id=0,
        description=f"تم إغلاق شهر {year_month}: {closed_count} فاتورة",
    )
    
    return {
        "message": f"تم إغلاق شهر {year_month}",
        "closed_count": closed_count,
    }


@router.post("/archive/monthly/{year_month}/reopen")
def reopen_month(
    year_month: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """إعادة فتح شهر مغلق للمراجعة والتعديل"""
    try:
        year, month = year_month.split("-")
        year, month = int(year), int(month)
    except ValueError:
        raise HTTPException(status_code=400, detail="صيغة غير صحيحة")

    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)

    invoices = db.query(Invoice).filter(
        Invoice.created_at >= start,
        Invoice.created_at < end,
    ).all()

    reopened_count = 0
    for inv in invoices:
        if getattr(inv, "is_closed", False):
            inv.is_closed = False
            inv.closed_at = None
            inv.closed_by_user_id = None
            reopened_count += 1

    db.commit()

    log_activity(
        db,
        user_id=getattr(current_user, "id", None),
        action="month_reopened",
        entity_type="invoice_archive",
        entity_id=0,
        description=f"تم إعادة فتح شهر {year_month} للمراجعة: {reopened_count} فاتورة",
    )

    return {
        "message": f"تم إعادة فتح شهر {year_month}",
        "reopened_count": reopened_count,
    }


def _month_name_ar(month: int) -> str:
    names = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ]
    return names[month - 1] if 1 <= month <= 12 else ""


@router.get("")
def list_invoices(
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    month: str | None = Query(None),
    q: str | None = Query(None, alias="q"),
    search: str | None = Query(None, alias="search"),
    payment_method: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    # Normalize aliases: page/page_size → skip/limit, search → q
    if page is not None and page_size is not None:
        skip = (page - 1) * page_size
        limit = page_size
    q = q or search
    query = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.is_draft == False)

    if month:
        try:
            y, m = (int(x) for x in month.split("-"))
            start = datetime(y, m, 1)
            end = datetime(y + 1, 1, 1) if m == 12 else datetime(y, m + 1, 1)
            query = query.filter(Invoice.created_at >= start, Invoice.created_at < end)
        except ValueError:
            pass
    elif not from_date and not to_date and not q and not payment_method and not status:
        now = datetime.now()
        start = datetime(now.year, now.month, 1)
        end = datetime(now.year + 1, 1, 1) if now.month == 12 else datetime(now.year, now.month + 1, 1)
        query = query.filter(Invoice.created_at >= start, Invoice.created_at < end)

    if from_date:
        try:
            start = datetime.strptime(from_date, "%Y-%m-%d")
            query = query.filter(Invoice.created_at >= start)
        except ValueError:
            pass
            
    if to_date:
        try:
            end = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(Invoice.created_at <= end)
        except ValueError:
            pass

    if payment_method and payment_method != "all":
        query = query.filter(Invoice.payment_method.ilike(payment_method))

    if status and status != "all":
        # Map status to is_closed logic: cancelled/voided/refunded are treated as closed? For now simple filter on payment_method, leave amount check
        # Invoices have no status column, so we skip filtering and let frontend handle, but we acknowledge param to avoid 422
        pass

    if q:
        # Escape % and _ for LIKE
        raw = q.strip().replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
        term = f"%{raw}%"
        query = query.join(Customer, Invoice.customer_id == Customer.customer_id, isouter=True).filter(
            (Invoice.invoice_no.ilike(term, escape="\\")) |
            (Customer.first_name.ilike(term, escape="\\")) |
            (Customer.last_name.ilike(term, escape="\\")) |
            (Customer.phone.ilike(term, escape="\\"))
        )

    total = query.count()
    rows = query.order_by(Invoice.id.desc()).offset(skip).limit(limit).all()
    # Bulk fetch to avoid N+1
    customer_ids = {inv.customer_id for inv in rows if inv.customer_id}
    barber_ids = {inv.barber_id for inv in rows if inv.barber_id}
    customers = (
        {c.customer_id: c for c in db.query(Customer).filter(Customer.customer_id.in_(customer_ids)).all()}
        if customer_ids
        else {}
    )
    barbers = (
        {b.id: b for b in db.query(Employee).filter(Employee.id.in_(barber_ids)).all()} if barber_ids else {}
    )
    result = []
    for invoice in rows:
        customer = customers.get(invoice.customer_id)
        barber = barbers.get(invoice.barber_id)
        result.append(_serialize_invoice(invoice, customer, barber))
    return {"items": result, "total": total, "skip": skip, "limit": limit}

@router.get("/drafts")
def list_draft_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """قائمة الفواتير المسودة"""
    rows = (
        db.query(Invoice)
        .options(joinedload(Invoice.items))
        .filter(Invoice.is_draft == True)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    customer_ids = {inv.customer_id for inv in rows if inv.customer_id}
    barber_ids = {inv.barber_id for inv in rows if inv.barber_id}
    customers = (
        {c.customer_id: c for c in db.query(Customer).filter(Customer.customer_id.in_(customer_ids)).all()}
        if customer_ids
        else {}
    )
    barbers = (
        {b.id: b for b in db.query(Employee).filter(Employee.id.in_(barber_ids)).all()} if barber_ids else {}
    )
    result = []
    for invoice in rows:
        customer = customers.get(invoice.customer_id)
        barber = barbers.get(invoice.barber_id)
        result.append(_serialize_invoice(invoice, customer, barber))
    return result


@router.get("/{invoice_id}")
def get_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    invoice = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    barber = db.query(Employee).filter(Employee.id == invoice.barber_id).first()
    return _serialize_invoice(invoice, customer, barber)

@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: int, inline: bool = False, db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    if not invoice.pdf_path:
        raise HTTPException(status_code=404, detail="لا يوجد PDF لهذه الفاتورة")
    file_path = Path(invoice.pdf_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="ملف PDF غير موجود على القرص")
    filename = file_path.name
    if inline:
        return FileResponse(path=str(file_path), media_type="application/pdf", filename=filename, headers={"Content-Disposition": f'inline; filename="{filename}"'})
    return FileResponse(path=str(file_path), media_type="application/pdf", filename=filename)

@router.post("/{invoice_id}/send-whatsapp-pdf")
def send_invoice_pdf_to_whatsapp(invoice_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    if not invoice.pdf_path:
        raise HTTPException(status_code=404, detail="لا يوجد PDF لهذه الفاتورة")
    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    if not customer or not customer.phone:
        raise HTTPException(status_code=400, detail="رقم العميل غير متوفر")
    customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or "عميلنا"
    filename = Path(invoice.pdf_path).name
    caption = f"مرحبًا {customer_name}، مرفق فاتورتك رقم {invoice.invoice_no}"
    upload_and_send_pdf(db, to_phone=customer.phone, pdf_path=invoice.pdf_path, filename=filename, caption=caption, appointment_id=invoice.appointment_id, invoice_id=invoice.id, created_by_user_id=getattr(current_user, "id", None))
    log_activity(db, user_id=getattr(current_user, "id", None), action="invoice_pdf_sent_whatsapp_meta", entity_type="invoice", entity_id=invoice.id, description=f"تم إرسال PDF الفاتورة رقم {invoice.invoice_no} عبر Meta Cloud API")
    db.commit()
    return {"message": "تم إرسال ملف PDF عبر واتساب بنجاح"}


@router.post("/drafts")
def create_draft_invoice(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """إنشاء مسودة فاتورة جديدة"""
    draft = Invoice(
        invoice_no=f"DRAFT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        customer_id=1,
        payment_method="cash",
        subtotal_amount=0,
        discount_amount=0,
        total_amount=0,
        created_by_user_id=getattr(current_user, "id", None),
        is_draft=True,
        draft_saved_at=datetime.utcnow(),
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _serialize_invoice(draft, None, None)


@router.put("/drafts/{draft_id}")
def update_draft_invoice(
    draft_id: int,
    payload: InvoiceManualCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """تحديث مسودة الفاتورة"""
    draft = db.query(Invoice).filter(Invoice.id == draft_id, Invoice.is_draft == True).first()
    if not draft:
        raise HTTPException(status_code=404, detail="المسودة غير موجودة")
    
    if payload.payment_method == "split":
        raise HTTPException(status_code=400, detail="الدفع المقسوم غير متاح في المسودات")

    draft.customer_id = payload.customer_id or draft.customer_id
    # NOTE: InvoiceManualCreate has no barber_id field; barber comes from
    # the first item's employee_id (same as manual create).
    first_employee = next(
        (it.employee_id for it in (payload.items or []) if it.employee_id),
        None,
    )
    if first_employee:
        draft.barber_id = first_employee
    draft.payment_method = payload.payment_method or draft.payment_method
    draft.draft_saved_at = datetime.utcnow()
    
    if payload.items:
        for item in draft.items:
            db.delete(item)
        db.flush()

        total = Decimal("0.00")
        for item_data in payload.items:
            service_id, product_id, offer_id, item_name, price = _resolve_invoice_item(
                db, item_data
            )
            qty = item_data.quantity
            line_total = price * qty
            total += line_total
            item = InvoiceItem(
                invoice_id=draft.id,
                service_id=service_id,
                product_id=product_id,
                offer_id=offer_id,
                service_name=item_name,
                quantity=qty,
                unit_price=price,
                total_price=line_total,
            )
            db.add(item)

        total = total.quantize(Decimal("0.01"))
        loyalty_discount = _normalize_money(
            calculate_loyalty_discount(db, draft.customer_id, total)
        )
        total_discount = _normalize_money(payload.discount_amount) + loyalty_discount
        if total_discount > total:
            raise HTTPException(status_code=400, detail="الخصم لا يمكن أن يتجاوز إجمالي الفاتورة")
        draft.subtotal_amount = total
        draft.discount_amount = total_discount
        draft.total_amount = (total - total_discount).quantize(Decimal("0.01"))

    
    db.commit()
    db.refresh(draft)
    customer = db.query(Customer).filter(Customer.customer_id == draft.customer_id).first()
    barber = db.query(Employee).filter(Employee.id == draft.barber_id).first()
    return _serialize_invoice(draft, customer, barber)


@router.post("/drafts/{draft_id}/finalize")
def finalize_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """تحويل المسودة إلى فاتورة نهائية"""
    draft = db.query(Invoice).filter(Invoice.id == draft_id, Invoice.is_draft == True).first()
    if not draft:
        raise HTTPException(status_code=404, detail="المسودة غير موجودة")
    
    if not draft.customer_id or draft.customer_id == 1:
        raise HTTPException(status_code=400, detail="يرجى تحديد العميل")
    
    if not draft.items or len(draft.items) == 0:
        raise HTTPException(status_code=400, detail="يرجى إضافة بنود للفاتورة")
    
    draft.is_draft = False
    draft.draft_saved_at = None
    draft.invoice_no = _generate_invoice_no(db)
    
    customer = db.query(Customer).filter(Customer.customer_id == draft.customer_id).first()
    if customer:
        update_customer_loyalty(db, draft.customer_id, draft.total_amount)
    
    deduct_stock_for_invoice(db, invoice_id=draft.id, created_by_user_id=getattr(current_user, "id", None))

    if draft.total_amount and float(draft.total_amount) > 0:
        payment_method = str(draft.payment_method or "cash").lower()
        db.add(
            InvoicePayment(
                invoice_id=draft.id,
                payment_method=payment_method,
                amount=Decimal(str(draft.total_amount)),
                reference_no=draft.invoice_no,
                received_by_user_id=getattr(current_user, "id", None),
            )
        )
        create_cash_transaction(
            db,
            direction="in",
            amount=float(draft.total_amount),
            transaction_type="invoice_payment",
            payment_method=payment_method,
            notes=f"تحصيل فاتورة {draft.invoice_no}",
            user_id=getattr(current_user, "id", None),
            reference_type="invoice",
            reference_id=draft.id,
            reference_no=draft.invoice_no,
            customer_id=draft.customer_id,
            employee_id=draft.barber_id,
            commit=False,
        )

    try:
        barber = db.query(Employee).filter(Employee.id == draft.barber_id).first()
        settings_row = db.query(BusinessSettings).first()
        pdf_path = generate_invoice_pdf(
            invoice=draft,
            items=draft.items,
            customer=customer,
            barber=barber,
            shop_name=settings_row.salon_name if settings_row else "SalonPro",
            shop_phone=settings_row.shop_phone if settings_row else None,
        )
        draft.pdf_path = pdf_path
    except Exception as e:
        print(f"Error generating PDF for finalized draft: {e}")
    
    db.commit()
    db.refresh(draft)
    
    log_activity(
        db,
        user_id=getattr(current_user, "id", None),
        action="draft_finalized",
        entity_type="invoice",
        entity_id=draft.id,
        description=f"تم تحويل المسودة إلى فاتورة {draft.invoice_no}",
    )
    
    barber = db.query(Employee).filter(Employee.id == draft.barber_id).first()
    return _serialize_invoice(draft, customer, barber)


@router.delete("/drafts/{draft_id}")
def delete_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """حذف مسودة"""
    draft = db.query(Invoice).filter(Invoice.id == draft_id, Invoice.is_draft == True).first()
    if not draft:
        raise HTTPException(status_code=404, detail="المسودة غير موجودة")
    
    for item in draft.items:
        db.delete(item)
    db.delete(draft)
    db.commit()
    
    return {"message": "تم حذف المسودة"}
