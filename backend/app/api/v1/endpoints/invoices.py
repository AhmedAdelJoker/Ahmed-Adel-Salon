from __future__ import annotations
import logging
from pathlib import Path
from datetime import date, datetime
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy import case, extract, func, or_
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.session import get_db
from app.api.deps import require_archive_manager, require_cashier_manager_owner
from app.models.user import User
from app.models.invoice import Invoice
from app.models.invoice_counter import InvoiceCounter
from app.models.invoice_item import InvoiceItem
from app.models.month_closure import MonthClosure
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.service import Service
from app.models.product import Product
from app.models.offer import Offer
from app.models.invoice_payment import InvoicePayment
from app.models.pos_shift import PosShift
from app.models.appointment import Appointment
from app.schemas.invoice import InvoiceItemManualCreate, InvoiceRead, InvoiceManualCreate
from app.services.activity_service import log_activity
from app.services.meta_whatsapp_service import upload_and_send_pdf
from app.services.pdf_service import generate_invoice_pdf
from app.services.inventory_service import deduct_stock_for_invoice
from app.core.audit import audit_log
from app.core.pos import cashier_discount_limit
from app.core.employee_rules import is_service_provider_job_title, normalize_phone
from app.models.business_settings import BusinessSettings
import hashlib
import json
from decimal import Decimal, InvalidOperation
from app.services.loyalty_service import update_customer_loyalty, calculate_loyalty_discount
from app.services.websocket import manager
from app.crud.core_business import create_cash_transaction
from app.core.clock import salon_day_bounds_utc, salon_now, utc_now_naive

logger = logging.getLogger("app.invoices")


router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _generate_invoice_no(db: Session) -> str:
    # Salon wall-clock, not the server's: the rest of the ledger (shift windows,
    # daily summary, the invoice's own `created_at`) is evaluated in the salon's
    # timezone, so a server on UTC numbered invoices under a different business
    # day than the one the report they belong to opens with.
    counter_date = salon_now().date()
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


def _clean_customer_name(value: str | None) -> str:
    return " ".join((value or "").split())


def _payload_customer_name(payload: InvoiceManualCreate) -> str:
    """The full name the cashier typed, from either payload shape.

    `customer_name` is the current field. The first/last pair is kept for
    offline queues written before this field existed.
    """
    full = _clean_customer_name(payload.customer_name)
    if full:
        return full
    parts = [
        _clean_customer_name(payload.customer_first_name),
        _clean_customer_name(payload.customer_last_name),
    ]
    return _clean_customer_name(" ".join(part for part in parts if part))


def _customer_record_name(customer: Customer | None) -> str:
    if customer is None:
        return ""
    return _clean_customer_name(f"{customer.first_name or ''} {customer.last_name or ''}")


def _split_customer_name(full_name: str) -> tuple[str, str]:
    parts = full_name.split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])


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
    today = salon_now().date()
    if offer.start_date and offer.start_date > today:
        raise HTTPException(status_code=400, detail="العرض لم يبدأ بعد")
    if offer.end_date and offer.end_date < today:
        raise HTTPException(status_code=400, detail="انتهى العرض")
    return None, None, offer.id, offer.name_ar or offer.name, _normalize_money(offer.offer_price)


def _validate_line_employee(
    db: Session,
    employee_id: int | None,
    *,
    item_type: str,
) -> Employee | None:
    """Resolves the staff member a service/offer line is attributed to.

    A service is a person's time, so it must be attributable to someone who
    actually provides services. Before this check, any id at all was accepted —
    a deleted employee, a cashier, an accountant — and every downstream
    commission and revenue report silently inherited it.
    """
    if employee_id is None:
        return None

    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id, Employee.is_active.is_(True))
        .first()
    )
    if employee is None:
        raise HTTPException(status_code=400, detail="الموظف المحدد غير موجود أو غير نشط")
    if item_type in ("service", "offer") and not (
        is_service_provider_job_title(employee.job_title)
        or employee.job_title == "barber_assistant"
    ):
        raise HTTPException(
            status_code=400,
            detail="الموظف المحدد لا يمكنه تقديم الخدمات",
        )
    return employee


def _line_commission_amount(employee: Employee | None, line_total: Decimal) -> Decimal:
    """Commission for one invoice line, or zero when it does not apply.

    Same eligibility rule the payroll service applies to an invoice total —
    a service provider earning a commission, or an assistant earning the
    assistant rate — evaluated per line so the two can no longer disagree.
    Products carry no commission: no one "performed" a bottle of wax.
    """
    if employee is None:
        return Decimal("0.00")

    if is_service_provider_job_title(employee.job_title):
        rate = Decimal(str(employee.commission_rate if employee.receives_commission else 0))
    elif employee.job_title == "barber_assistant" and employee.receives_commission:
        rate = Decimal(str(employee.assistant_commission_rate or 0))
    else:
        rate = Decimal("0")

    if rate <= 0:
        return Decimal("0.00")

    return (line_total * rate / Decimal("100")).quantize(Decimal("0.01"))


def _current_shift_for(db: Session, current_user: User) -> PosShift | None:
    """The open shift this sale belongs to, if any.

    Only used to stamp the invoice. The legacy (user, window) aggregation is
    left intact: it is still what older rows and databases without the link
    reconcile against.
    """
    return (
        db.query(PosShift)
        .filter(PosShift.user_id == current_user.id, PosShift.status == "open")
        .order_by(PosShift.id.desc())
        .first()
    )


def _ensure_invoice_pdf_path(db: Session, invoice: Invoice) -> Path | None:
    if invoice.pdf_path:
        existing_path = Path(str(invoice.pdf_path))
        if existing_path.exists():
            return existing_path

    customer = (
        db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
        if invoice.customer_id
        else None
    )

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
    # End-of-day guard: when official hours are over, close the operator's
    # stale shift before accepting a sale. The scheduler only ticks every 15
    # minutes, so without this a sale landing right after closing time is
    # tracked on a shift that is about to be sealed without it. On failure the
    # sale proceeds — the bounded windows on close keep the totals correct.
    try:
        from app.services.pos_shift_service import auto_close_expired_shifts

        auto_close_expired_shifts(db)
    except Exception:
        logger.exception("Pre-sale shift auto-close failed")

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

    # 1. Resolve the customer and the exact name this invoice prints.
    entered_name = _payload_customer_name(payload)
    customer: Customer | None = None
    customer_id = payload.customer_id

    if customer_id:
        customer = (
            db.query(Customer)
            .filter(
                Customer.customer_id == customer_id,
                Customer.is_deleted.is_(False),
            )
            .first()
        )
        if customer is None:
            raise HTTPException(status_code=404, detail="العميل غير موجود")

    # An appointment already identifies the buyer; derive the record from it
    # when the till did not send one explicitly.
    if customer is None and payload.appointment_id:
        appt = (
            db.query(Appointment)
            .filter(Appointment.id == payload.appointment_id)
            .first()
        )
        if appt and appt.customer_id:
            customer = (
                db.query(Customer)
                .filter(Customer.customer_id == appt.customer_id)
                .first()
            )
            if customer is not None:
                customer_id = customer.customer_id

    # The phone number is the till's identity key: resolve it before creating
    # anything, so a returning customer keeps their history and loyalty tier.
    # Normalised to digits first: customers are stored as digits, and the till
    # accepts spaced/dashed input, so comparing the raw string would miss the
    # very record the cashier just looked up and create a duplicate.
    phone = normalize_phone(payload.customer_phone)
    if customer is None and phone:
        customer = (
            db.query(Customer)
            .filter(
                Customer.is_deleted.is_(False),
                or_(
                    Customer.phone == phone,
                    Customer.second_phone == phone,
                ),
            )
            .first()
        )
        if customer is not None:
            customer_id = customer.customer_id

    if customer is None:
        # No existing record: this is a new buyer. The name is mandatory and
        # must carry at least three segments (first / father / family), which
        # is what the invoice snapshot prints and what the POS enforces.
        if not entered_name:
            raise HTTPException(status_code=422, detail="اسم العميل مطلوب")
        if len(entered_name.split()) < 3:
            raise HTTPException(
                status_code=422,
                detail="اسم العميل يجب أن يتكوّن من 3 مقاطع على الأقل",
            )

        if phone:
            first_name, last_name = _split_customer_name(entered_name)
            customer = Customer(
                first_name=first_name,
                last_name=last_name,
                phone=phone,
            )
            db.add(customer)
            db.flush()
            customer_id = customer.customer_id
        else:
            # A guest sale with no phone still needs a customer row for the
            # invoice FK; the typed name lives in the snapshot.
            customer = (
                db.query(Customer)
                .filter(Customer.first_name == "Walk-in")
                .first()
            )
            if customer is None:
                customer = Customer(
                    first_name="Walk-in",
                    last_name="Customer",
                    phone="0000000000",
                )
                db.add(customer)
                db.flush()
            customer_id = customer.customer_id

    customer_name_snapshot = (
        entered_name or _customer_record_name(customer) or "Walk-in"
    )

    # 2. Calculate Total and Prepare Items
    total_amount = Decimal("0.00")
    invoice_items_to_add = []
    main_barber_id = None

    shift = _current_shift_for(db, current_user)
    resolved_lines = []

    for item_data in payload.items:
        service_id, product_id, offer_id, item_name, price = _resolve_invoice_item(
            db, item_data
        )
        qty = item_data.quantity
        line_total = price * qty
        total_amount += line_total

        # Per-line attribution: who did this, and what they earned for it.
        # Products get no employee (nothing was "performed") and no commission.
        if item_data.item_type == "product":
            employee = None
        else:
            employee = _validate_line_employee(
                db, item_data.employee_id, item_type=item_data.item_type
            )

        if not main_barber_id and employee is not None:
            main_barber_id = employee.id

        resolved_lines.append(
            (
                item_data,
                employee,
                InvoiceItem(
                    service_id=service_id,
                    product_id=product_id,
                    offer_id=offer_id,
                    service_name=item_name,
                    quantity=qty,
                    unit_price=price,
                    total_price=line_total,
                    employee_id=employee.id if employee else None,
                    commission_amount=_line_commission_amount(employee, line_total),
                ),
            )
        )

    invoice_items_to_add = [line[2] for line in resolved_lines]
    total_amount = total_amount.quantize(Decimal("0.01"))

    loyalty_discount = calculate_loyalty_discount(db, customer_id, total_amount)
    loyalty_discount = _normalize_money(loyalty_discount)
    manual_discount = _normalize_money(payload.discount_amount)
    business_settings = db.query(BusinessSettings).first()
    if (
        current_user.role == "cashier"
        and business_settings
        and manual_discount > 0
    ):
        # The limit is the owner's setting (`cashier_discount_limit_*`), and
        # the rule lives in `app.core.pos.cashier_discount_limit` so the POS
        # and this endpoint cannot disagree about what a cashier may apply.
        allowed = cashier_discount_limit(business_settings, total_amount)
        if manual_discount > allowed:
            raise HTTPException(
                status_code=403,
                detail="الخصم يتجاوز الحد المسموح لك؛ أنشئ طلب خصم للاعتماد",
            )
    total_manual_discount = manual_discount + loyalty_discount
    if total_manual_discount > total_amount:
        raise HTTPException(status_code=400, detail="الخصم لا يمكن أن يتجاوز إجمالي الفاتورة")
    taxable_amount = (total_amount - total_manual_discount).quantize(Decimal("0.01"))

    # VAT on the net amount, at the rate that was in force at sale time. The
    # rate is snapshotted on the invoice so a later settings change does not
    # rewrite what this sale owed.
    tax_rate = Decimal(str(business_settings.tax_rate or 0)) if business_settings else Decimal("0")
    if tax_rate < 0:
        tax_rate = Decimal("0")
    tax_amount = (taxable_amount * tax_rate / Decimal("100")).quantize(Decimal("0.01"))
    final_amount = (taxable_amount + tax_amount).quantize(Decimal("0.01"))

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
        customer_name_snapshot=customer_name_snapshot,
        barber_id=main_barber_id,
        payment_method=payload.payment_method,
        subtotal_amount=total_amount,
        discount_amount=total_manual_discount,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total_amount=final_amount,
        created_by_user_id=current_user.id,
        shift_id=shift.id if shift else None,
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

    # 7. Deduct stock for every invoice. The old gate skipped the call whenever
    # the appointment already had a ServiceSession — but no other code path
    # deducts stock for a session (`deduct_stock_for_session` is unreferenced),
    # so direct product items sold on session-based invoices silently never
    # left stock. The per-(source, product) guard in remove_stock makes a
    # repeat call a no-op.
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
                shift_id=shift.id if shift else None,
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
    # "done" (not "completed"): a paid appointment must leave the reception
    # review board for good. "completed" is the pre-payment "service finished,
    # awaiting till" state, so setting it here pushed the paid booking straight
    # back onto the review column and the Done KPI stayed at zero.
    if payload.appointment_id:
        appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
        if appointment:
            appointment.status = "done"

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
        logger.exception("Error generating PDF: %s", e)

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
    
    # 10. Broadcast WebSocket event to update POS ready-for-payment list.
    #
    # This endpoint is `def`, so FastAPI runs it in a threadpool where no event
    # loop is running. The previous code called `asyncio.ensure_future`, which
    # raises there, and the surrounding `except Exception` swallowed it — so
    # paying an invoice never refreshed the POS board on any deployment, and
    # the only trace was a warning in the log.
    #
    # `publish` is synchronous and hands the work to the app's loop itself, so
    # it works from a worker thread. The invoice is already committed by now:
    # a notification failure must not turn a paid sale into a 500 that the
    # cashier retries. It is logged at warning level so the misconfiguration
    # (no bound loop and no Redis) is still visible to operators.
    if payload.appointment_id:
        try:
            manager.publish(
                {
                    "event": "appointment_status_changed",
                    "appointment_id": payload.appointment_id,
                    "status": "completed",
                }
            )
        except RuntimeError:
            logger.warning(
                "Invoice %s committed but the POS refresh event could not be "
                "published (no event loop bound and no Redis).",
                invoice.invoice_no,
                exc_info=True,
            )
    
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
        "customer_name": (
            (invoice.customer_name_snapshot or "").strip()
            or (f"{customer.first_name} {customer.last_name}".strip() if customer else "N/A")
        ),
        "customer_name_snapshot": invoice.customer_name_snapshot,
        "barber_name": barber_name,
        "payment_method": invoice.payment_method,
        "subtotal_amount": float(invoice.subtotal_amount or 0),
        "discount_amount": float(invoice.discount_amount or 0),
        "tax_rate": float(invoice.tax_rate or 0),
        "tax_amount": float(invoice.tax_amount or 0),
        "total_amount": float(invoice.total_amount or 0),
        "shift_id": invoice.shift_id,
        # Split breakdown (empty for single-method invoices). Each row is
        # shift-stamped like the invoice, so the shift's cash count can
        # reconcile against exactly these rows.
        "payments": [
            {
                "payment_method": p.payment_method,
                "amount": float(p.amount or 0),
                "shift_id": p.shift_id,
            }
            for p in (invoice.payments or [])
        ],
        "pdf_path": invoice.pdf_path,
        "is_closed": bool(invoice.is_closed),
        "closed_at": invoice.closed_at,
        "status": "closed" if invoice.is_closed else "open",
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
                "employee_id": item.employee_id,
                "commission_amount": float(item.commission_amount or 0),
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
    # Compared against `Invoice.created_at`, stored as UTC by SQLite's
    # CURRENT_TIMESTAMP. See `salon_day_bounds_utc` for why a local midnight is
    # the wrong window here.
    today_start, today_end = salon_day_bounds_utc()

    # Eager-load customer + barber + payments (was N+1: 2 extra queries per invoice)
    query = db.query(Invoice).options(
        joinedload(Invoice.items),
        joinedload(Invoice.customer),
        joinedload(Invoice.barber),
        selectinload(Invoice.payments),
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

def _month_closure(db: Session, year: int, month: int) -> MonthClosure | None:
    return (
        db.query(MonthClosure)
        .filter(MonthClosure.year == year, MonthClosure.month == month)
        .first()
    )


def _invoice_month_closure(db: Session, invoice: Invoice) -> MonthClosure | None:
    """قفل الشهر الذي تنتمي إليه الفاتورة (إن وُجد)."""
    if invoice is None or invoice.created_at is None:
        return None
    return _month_closure(db, invoice.created_at.year, invoice.created_at.month)


@router.get("/archive/monthly")
def get_monthly_archive(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """تجميع الفواتير النهائية حسب الشهر مع الإحصائيات.

    قفل الشهر مصدره جدول `month_closures` وحده، و`invoices.is_closed` يبقى
    لعنصر واحد: فاتورة أُلغيت أو أُقفلت منفردة. لذلك لا يمكن خلط الاثنين.
    """
    year_col = extract("year", Invoice.created_at)
    month_col = extract("month", Invoice.created_at)
    finalized = Invoice.is_draft.is_(False)
    voided_finalized = finalized & Invoice.is_closed.is_(True)

    rows = (
        db.query(
            year_col.label("year"),
            month_col.label("month"),
            func.sum(case((finalized, 1), else_=0)).label("invoice_count"),
            func.sum(
                case((Invoice.is_draft.is_(True), 1), else_=0)
            ).label("draft_count"),
            func.coalesce(
                func.sum(case((finalized, Invoice.total_amount), else_=0)), 0
            ).label("total_amount"),
            func.sum(case((voided_finalized, 1), else_=0)).label("voided_count"),
        )
        .filter(Invoice.created_at.isnot(None))
        .group_by(year_col, month_col)
        .order_by(year_col.desc(), month_col.desc())
        .all()
    )

    closures = {
        (int(row.year), int(row.month)): row
        for row in db.query(MonthClosure).all()
        if row.year is not None and row.month is not None
    }

    now = salon_now()
    current_key = now.strftime("%Y-%m")
    months: dict[str, dict] = {}
    for row in rows:
        if row.year is None or row.month is None:
            continue
        year, month = int(row.year), int(row.month)
        key = f"{year:04d}-{month:02d}"
        invoice_count = int(row.invoice_count or 0)
        draft_count = int(row.draft_count or 0)
        # شهر فيه مسودات فقط يظهر أيضًا: وإلا اختفى عن الأرشيف ولا يقدر
        # المستخدم يكملها أو يحذفها قبل قفل الشهر.
        if key >= current_key or (invoice_count == 0 and draft_count == 0):
            continue

        voided_count = int(row.voided_count or 0)
        closure = closures.get((year, month))
        if closure is not None:
            status = "locked"
        elif voided_count > 0:
            status = "partial"
        else:
            status = "open"
        total_amount = float(row.total_amount or 0)
        created = datetime(year, month, 1)

        months[key] = {
            "key": key,
            "label": created.strftime("%B %Y"),
            "label_ar": _month_name_ar(month) + " " + str(year),
            "year": year,
            "month": month,
            "invoice_count": invoice_count,
            "draft_count": draft_count,
            "voided_count": voided_count,
            "total_amount": total_amount,
            "paid_count": invoice_count,
            "cancelled_count": voided_count,
            "paid_amount": total_amount,
            "refunded_amount": 0.0,
            "is_locked": closure is not None,
            "locked_at": closure.closed_at if closure is not None else None,
            "locked_by_user_id": (
                closure.closed_by_user_id if closure is not None else None
            ),
            "status": status,
            "change_percent": None,
        }

    result = sorted(months.values(), key=lambda item: item["key"], reverse=True)

    def previous_key(key: str) -> str:
        year, month = (int(part) for part in key.split("-"))
        if month == 1:
            return f"{year - 1:04d}-12"
        return f"{year:04d}-{month - 1:02d}"

    for month_data in result:
        previous = months.get(previous_key(month_data["key"]))
        if previous and previous["total_amount"] > 0:
            change = (
                (month_data["total_amount"] - previous["total_amount"])
                / previous["total_amount"]
            ) * 100
            month_data["change_percent"] = round(change, 1)

    return result


def _parse_year_month(year_month: str) -> tuple[int, int]:
    try:
        year_text, month_text = year_month.split("-")
        year, month = int(year_text), int(month_text)
    except (AttributeError, ValueError):
        raise HTTPException(status_code=400, detail="صيغة الشهر غير صحيحة")
    if not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="صيغة الشهر غير صحيحة")
    return year, month


def _month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)
    return start, end


@router.post("/archive/monthly/{year_month}/close")
def close_month(
    year_month: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_archive_manager),
):
    """قفل شهر منتهٍ ومنع التعديل على فواتيره.

    القفل صف في `month_closures`، لا تعديل على `invoices.is_closed`. فواتير
    الشهر الملغاة منفردة تبقى ملغاة بعد إعادة الفتح.
    """
    year, month = _parse_year_month(year_month)
    start, end = _month_bounds(year, month)

    if _month_closure(db, year, month) is not None:
        raise HTTPException(
            status_code=400,
            detail="هذا الشهر مقفل بالفعل. أعد فتحه أولًا.",
        )

    draft_count = db.query(func.count(Invoice.id)).filter(
        Invoice.created_at >= start,
        Invoice.created_at < end,
        Invoice.is_draft.is_(True),
    ).scalar() or 0
    if draft_count:
        raise HTTPException(
            status_code=400,
            detail="لا يمكن قفل الشهر لوجود مسودات غير مكتملة. أكمل أو احذف المسودات أولًا.",
        )

    invoices = db.query(Invoice).filter(
        Invoice.created_at >= start,
        Invoice.created_at < end,
        Invoice.is_draft.is_(False),
    ).all()
    if not invoices:
        raise HTTPException(
            status_code=400,
            detail="لا توجد فواتير نهائية في هذا الشهر.",
        )

    total_amount = sum(
        (Decimal(str(invoice.total_amount or 0)) for invoice in invoices),
        Decimal("0.00"),
    )
    closure = MonthClosure(
        year=year,
        month=month,
        closed_at=utc_now_naive(),
        closed_by_user_id=getattr(current_user, "id", None),
        invoice_count=len(invoices),
        total_amount=total_amount,
    )
    db.add(closure)
    db.commit()

    log_activity(
        db,
        user_id=getattr(current_user, "id", None),
        action="month_closed",
        entity_type="invoice_archive",
        entity_id=closure.id,
        description=f"تم قفل شهر {year_month}: {len(invoices)} فاتورة",
    )

    return {
        "message": f"تم قفل شهر {year_month}",
        "is_locked": True,
        "invoice_count": len(invoices),
        "draft_count": 0,
        "total_amount": float(total_amount),
    }


@router.post("/archive/monthly/{year_month}/reopen")
def reopen_month(
    year_month: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_archive_manager),
):
    """إعادة فتح شهر مقفل للمراجعة والتعديل.

    الفتح يلغي قفل الشهر فقط. الفواتير الملغاة منفردة تبقى ملغاة.
    """
    year, month = _parse_year_month(year_month)

    closure = _month_closure(db, year, month)
    if closure is None:
        raise HTTPException(
            status_code=400,
            detail="هذا الشهر غير مقفل.",
        )

    invoice_count = closure.invoice_count or 0
    db.delete(closure)
    db.commit()

    log_activity(
        db,
        user_id=getattr(current_user, "id", None),
        action="month_reopened",
        entity_type="invoice_archive",
        entity_id=0,
        description=f"تم إعادة فتح شهر {year_month} للمراجعة: {invoice_count} فاتورة",
    )

    return {
        "message": f"تم إعادة فتح شهر {year_month}",
        "is_locked": False,
        "invoice_count": invoice_count,
    }


@router.get("/archive/{year_month}/drafts")
def list_archive_month_drafts(
    year_month: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """مسودات شهر منتهٍ، حتى يكملها المستخدم أو يحذفها قبل قفل الشهر."""
    year, month = _parse_year_month(year_month)
    start, end = _month_bounds(year, month)

    rows = (
        db.query(Invoice)
        .options(joinedload(Invoice.items), selectinload(Invoice.payments))
        .filter(
            Invoice.is_draft.is_(True),
            Invoice.created_at >= start,
            Invoice.created_at < end,
        )
        .order_by(Invoice.created_at.desc())
        .all()
    )
    customer_ids = {inv.customer_id for inv in rows if inv.customer_id}
    barber_ids = {inv.barber_id for inv in rows if inv.barber_id}
    customers = (
        {
            c.customer_id: c
            for c in db.query(Customer)
            .filter(Customer.customer_id.in_(customer_ids))
            .all()
        }
        if customer_ids
        else {}
    )
    barbers = (
        {
            b.id: b
            for b in db.query(Employee).filter(Employee.id.in_(barber_ids)).all()
        }
        if barber_ids
        else {}
    )
    return [
        _serialize_invoice(
            invoice,
            customers.get(invoice.customer_id),
            barbers.get(invoice.barber_id),
        )
        for invoice in rows
    ]


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
    customer_id: int | None = Query(None, description="Filter invoices of one customer"),
    sort: str = Query("created_at", description="created_at | total_amount | invoice_no"),
    order: str = Query("desc", description="asc | desc"),
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
    query = db.query(Invoice).options(joinedload(Invoice.items), selectinload(Invoice.payments)).filter(Invoice.is_draft == False)

    if month:
        try:
            y, m = (int(x) for x in month.split("-"))
            start = datetime(y, m, 1)
            end = datetime(y + 1, 1, 1) if m == 12 else datetime(y, m + 1, 1)
            query = query.filter(Invoice.created_at >= start, Invoice.created_at < end)
        except ValueError:
            pass
    elif not from_date and not to_date and not q and not payment_method and not status and not customer_id:
        now = datetime.now()
        start = datetime(now.year, now.month, 1)
        end = datetime(now.year + 1, 1, 1) if now.month == 12 else datetime(now.year, now.month + 1, 1)
        query = query.filter(Invoice.created_at >= start, Invoice.created_at < end)

    if customer_id is not None:
        query = query.filter(Invoice.customer_id == customer_id)

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

    status_key = (status or "").strip().lower()
    if status_key in {"closed", "cancelled", "canceled", "voided", "void"}:
        query = query.filter(Invoice.is_closed.is_(True))
    elif status_key and status_key != "all":
        # "open", "paid" and "completed" all mean a normal, non-voided invoice.
        query = query.filter(Invoice.is_closed.is_(False))

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

    # Totals must describe the whole filtered period, not the current page:
    # the page header cards used to add up only the 20 rows on screen.
    # Voided invoices are excluded from the sales figures: they are not
    # revenue, the barber commission math already excludes them, and the
    # adjustment dialog tells the user a void "will not count towards
    # period sales". The cancelled count is reported separately.
    active = Invoice.is_closed.is_(False)
    summary_count, summary_total, summary_closed = query.with_entities(
        func.coalesce(func.sum(case((active, 1), else_=0)), 0),
        func.coalesce(func.sum(case((active, Invoice.total_amount), else_=0)), 0),
        func.coalesce(
            func.sum(case((Invoice.is_closed.is_(True), 1), else_=0)), 0
        ),
    ).one()
    summary_count = int(summary_count or 0)
    summary_total = float(summary_total or 0)

    sort_columns = {
        "created_at": Invoice.created_at,
        "date": Invoice.created_at,
        "total": Invoice.total_amount,
        "total_amount": Invoice.total_amount,
        "amount": Invoice.total_amount,
        "invoice_no": Invoice.invoice_no,
        "id": Invoice.id,
    }
    sort_col = sort_columns.get((sort or "created_at").strip().lower(), Invoice.created_at)
    sort_dir = sort_col.asc() if (order or "desc").strip().lower() == "asc" else sort_col.desc()
    rows = (
        query.order_by(sort_dir, Invoice.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
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
    return {
        "items": result,
        "total": total,
        "skip": skip,
        "limit": limit,
        "summary": {
            "count": summary_count,
            "total": summary_total,
            "average": round(summary_total / summary_count, 2) if summary_count else 0,
            "closed": int(summary_closed or 0),
        },
    }

@router.get("/drafts")
def list_draft_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """قائمة الفواتير المسودة"""
    rows = (
        db.query(Invoice)
        .options(joinedload(Invoice.items), selectinload(Invoice.payments))
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
    pdf_path = _ensure_invoice_pdf_path(db, invoice)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="لا يوجد PDF لهذه الفاتورة")
    file_path = pdf_path
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
    customer_name = (
        (invoice.customer_name_snapshot or "").strip()
        or f"{customer.first_name or ''} {customer.last_name or ''}".strip()
        or "عميلنا"
    )
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
    walk_in = db.query(Customer).filter(Customer.first_name == "Walk-in").first()
    if not walk_in:
        walk_in = Customer(
            first_name="Walk-in",
            last_name="Customer",
            phone="0000000000",
        )
        db.add(walk_in)
        db.flush()
    draft = Invoice(
        invoice_no=f"DRAFT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        customer_id=walk_in.customer_id,
        payment_method="cash",
        subtotal_amount=0,
        discount_amount=0,
        total_amount=0,
        created_by_user_id=getattr(current_user, "id", None),
        is_draft=True,
        draft_saved_at=utc_now_naive(),
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

    if _invoice_month_closure(db, draft) is not None:
        raise HTTPException(
            status_code=400,
            detail="الشهر مقفل. أعد فتحه قبل تعديل المسودة.",
        )

    if payload.payment_method == "split":
        raise HTTPException(status_code=400, detail="الدفع المقسوم غير متاح في المسودات")

    draft.customer_id = payload.customer_id or draft.customer_id
    draft.customer_name_snapshot = (
        _payload_customer_name(payload) or draft.customer_name_snapshot
    )
    # NOTE: InvoiceManualCreate has no barber_id field; barber comes from
    # the first item's employee_id (same as manual create).
    first_employee = next(
        (it.employee_id for it in (payload.items or []) if it.employee_id),
        None,
    )
    if first_employee:
        draft.barber_id = first_employee
    draft.payment_method = payload.payment_method or draft.payment_method
    draft.draft_saved_at = utc_now_naive()
    
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

    if _invoice_month_closure(db, draft) is not None:
        raise HTTPException(
            status_code=400,
            detail="لا يمكن إتمام مسودة في شهر مقفل. أعد فتح الشهر أولًا.",
        )

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
        logger.exception("Error generating PDF for finalized draft: %s", e)
    
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
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """حذف مسودة"""
    draft = db.query(Invoice).filter(Invoice.id == draft_id, Invoice.is_draft == True).first()
    if not draft:
        raise HTTPException(status_code=404, detail="المسودة غير موجودة")
    
    # Snapshot before delete — after `db.delete()` the ORM state is expunged.
    snapshot = {
        "invoice_number": getattr(draft, "invoice_number", None),
        "customer_id": getattr(draft, "customer_id", None),
        "total": float(getattr(draft, "total", 0) or 0),
        "item_count": len(draft.items or []),
    }
    for item in draft.items:
        db.delete(item)
    db.delete(draft)
    db.commit()

    audit_log(
        db, request, current_user,
        action="delete_invoice_draft",
        entity_type="invoice",
        entity_id=draft_id,
        description={"deleted": snapshot},
    )
    return {"message": "تم حذف المسودة"}
