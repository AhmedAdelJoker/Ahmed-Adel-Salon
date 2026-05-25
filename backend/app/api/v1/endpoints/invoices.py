from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner
from app.models.user import User
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.barber import Barber
from app.services.activity_service import log_activity
from app.services.meta_whatsapp_service import upload_and_send_pdf

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _serialize_invoice(invoice: Invoice, customer: Customer | None, barber: Barber | None):
    return {
        "id": invoice.id,
        "invoice_no": invoice.invoice_no,
        "appointment_id": invoice.appointment_id,
        "customer_id": invoice.customer_id,
        "barber_id": invoice.barber_id,
        "customer_name": (f"{customer.first_name or ''} {customer.last_name or ''}".strip() if customer else None),
        "barber_name": barber.display_name if barber else None,
        "payment_method": invoice.payment_method,
        "total_amount": float(invoice.total_amount or 0),
        "pdf_path": invoice.pdf_path,
        "created_at": invoice.created_at,
        "items": [{"id": item.id, "service_id": item.service_id, "service_name": item.service_name, "quantity": item.quantity, "unit_price": float(item.unit_price or 0), "total_price": float(item.total_price or 0)} for item in (invoice.items or [])],
    }

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
