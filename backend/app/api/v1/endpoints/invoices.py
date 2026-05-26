from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner
from app.models.user import User
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.customer import Customer
from app.models.barber import Barber
from app.models.service import Service
from app.models.product import Product
from app.models.appointment import Appointment
from app.schemas.invoice import InvoiceRead, InvoiceManualCreate
from app.services.activity_service import log_activity
from app.services.meta_whatsapp_service import upload_and_send_pdf
from app.services.pdf_service import generate_invoice_pdf
from app.services.inventory_service import deduct_stock_for_invoice
from app.models.business_settings import BusinessSettings
from decimal import Decimal

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _generate_invoice_no(db: Session) -> str:
    today_prefix = datetime.now().strftime("INV-%Y%m%d")
    count_today = db.query(Invoice).filter(Invoice.invoice_no.like(f"{today_prefix}%")).count()
    return f"{today_prefix}-{count_today + 1:04d}"


def _ensure_invoice_pdf_path(db: Session, invoice: Invoice) -> Path | None:
    if invoice.pdf_path:
        existing_path = Path(str(invoice.pdf_path))
        if existing_path.exists():
            return existing_path

    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    if not customer:
        return None

    barber = db.query(Barber).filter(Barber.id == invoice.barber_id).first()
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
):
    # 1. Handle Customer
    customer_id = payload.customer_id
    if not customer_id and payload.customer_first_name:
        # Create new customer
        new_customer = Customer(
            first_name=payload.customer_first_name,
            last_name=payload.customer_last_name,
            phone=payload.customer_phone,
        )
        db.add(new_customer)
        db.flush()
        customer_id = new_customer.customer_id
    elif not customer_id:
        # Walk-in customer (default to a special ID or create one if needed)
        # For now, let's assume customer_id is required or we have a default "Walk-in" customer
        # Or just allow null if model allows it (model says nullable=False for customer_id)
        # Let's find or create a "Walk-in" customer if not provided
        walk_in = db.query(Customer).filter(Customer.first_name == "Walk-in").first()
        if not walk_in:
            walk_in = Customer(first_name="Walk-in", last_name="Customer")
            db.add(walk_in)
            db.flush()
        customer_id = walk_in.customer_id

    # 2. Calculate Total and Prepare Items
    total_amount = Decimal("0.00")
    invoice_items_to_add = []
    
    # We use the first item's barber as the main barber for the invoice header
    main_barber_id = None
    
    for item_data in payload.items:
        qty = item_data.quantity or 1
        price = item_data.unit_price
        line_total = price * qty
        total_amount += line_total
        
        service_name = "عنصر"
        if item_data.item_type == "service" and item_data.service_id:
            service = db.query(Service).filter(Service.id == item_data.service_id).first()
            if service:
                service_name = service.name
        elif item_data.item_type == "product" and item_data.product_id:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()
            if product:
                service_name = product.name
        
        if not main_barber_id and item_data.employee_id:
            main_barber_id = item_data.employee_id
            
        invoice_items_to_add.append(
            InvoiceItem(
                service_id=item_data.service_id,
                product_id=item_data.product_id,
                service_name=service_name,
                quantity=qty,
                unit_price=price,
                total_price=line_total,
            )
        )

    # 3. Apply Discount
    total_amount -= payload.discount_amount
    if total_amount < 0:
        total_amount = Decimal("0.00")

    # 4. Create Invoice
    invoice = Invoice(
        invoice_no=_generate_invoice_no(db),
        appointment_id=payload.appointment_id,
        customer_id=customer_id,
        barber_id=main_barber_id,
        payment_method=payload.payment_method,
        total_amount=total_amount,
        created_by_user_id=current_user.id,
    )
    db.add(invoice)
    db.flush()

    # 5. Add Items
    for item in invoice_items_to_add:
        item.invoice_id = invoice.id
        db.add(item)
    
    # 6. Deduct stock for the invoice
    deduct_stock_for_invoice(db, invoice_id=invoice.id, created_by_user_id=current_user.id)

    # 7. Update Appointment Status if linked
    if payload.appointment_id:
        appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
        if appointment:
            appointment.status = "completed"

    # 7. Generate PDF
    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    barber = db.query(Barber).filter(Barber.id == invoice.barber_id).first()
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

    db.commit()
    db.refresh(invoice)
    
    return _serialize_invoice(invoice, customer, barber)


@router.get("")
def list_invoices(db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    rows = db.query(Invoice).options(joinedload(Invoice.items)).order_by(Invoice.id.desc()).all()
    result = []
    for invoice in rows:
        customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
        barber = db.query(Barber).filter(Barber.id == invoice.barber_id).first()
        result.append(_serialize_invoice(invoice, customer, barber))
    return result

@router.get("/{invoice_id}")
def get_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_cashier_manager_owner)):
    invoice = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    customer = db.query(Customer).filter(Customer.customer_id == invoice.customer_id).first()
    barber = db.query(Barber).filter(Barber.id == invoice.barber_id).first()
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
