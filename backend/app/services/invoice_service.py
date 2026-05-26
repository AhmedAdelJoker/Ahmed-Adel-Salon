from math import ceil
from datetime import datetime, time
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.customer import Customer
from app.models.barber import Barber


def generate_invoice_no(db: Session) -> str:
    today_prefix = datetime.now().strftime("INV-%Y%m%d")
    count_today = db.query(Invoice).filter(Invoice.invoice_no.like(f"{today_prefix}%")).count()
    return f"{today_prefix}-{count_today + 1:04d}"


def list_invoices_detailed(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    payment_method: str | None = None,
    search: str | None = None,
    start_date=None,
    end_date=None,
):
    query = (
        db.query(
            Invoice.id,
            Invoice.invoice_no,
            Customer.first_name.label("customer_name"),
            Barber.display_name.label("barber_name"),
            Invoice.total_amount,
            Invoice.payment_method,
            Invoice.created_at.label("issued_at"),
        )
        .join(Customer, Customer.customer_id == Invoice.customer_id)
        .outerjoin(Barber, Barber.id == Invoice.barber_id)
    )

    if payment_method:
        query = query.filter(Invoice.payment_method == payment_method)

    if start_date:
        query = query.filter(Invoice.created_at >= datetime.combine(start_date, time.min))

    if end_date:
        query = query.filter(Invoice.created_at <= datetime.combine(end_date, time.max))

    if search:
        value = f"%{search}%"
        query = query.filter(
            or_(
                Invoice.invoice_no.ilike(value),
                Customer.first_name.ilike(value),
                Barber.display_name.ilike(value),
            )
        )

    total = query.count()
    total_pages = max(ceil(total / page_size), 1)
    page = max(min(page, total_pages), 1)

    rows = (
        query.order_by(Invoice.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        {
            "id": row.id,
            "invoice_no": row.invoice_no,
            "customer_name": row.customer_name,
            "barber_name": row.barber_name,
            "total_amount": float(row.total_amount or 0),
            "payment_method": row.payment_method,
            "issued_at": row.issued_at,
        }
        for row in rows
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }