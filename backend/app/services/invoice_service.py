from math import ceil
from datetime import datetime, time
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.service_session import ServiceSession
from app.models.customer import Customer
from app.models.barber import Barber
from app.models.service import Service


def generate_invoice_no(db: Session) -> str:
    count = db.query(Invoice).count() + 1
    return f"INV-{count:04d}"


def create_invoice(db: Session, session: ServiceSession, payment_method: str) -> Invoice:
    total = float(session.service.price)
    points = int(total // 10)

    item = Invoice(
        invoice_no=generate_invoice_no(db),
        session_id=session.id,
        total_amount=total,
        payment_method=payment_method,
        points_added=points,
    )

    db.add(item)

    # Mark session as done after payment
    session.status = "done"

    db.commit()
    db.refresh(item)
    return item


def list_invoices_detailed(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    service_id: int | None = None,
    payment_method: str | None = None,
    search: str | None = None,
    start_date=None,
    end_date=None,
):
    query = (
        db.query(
            Invoice.id,
            Invoice.invoice_no,
            Invoice.session_id,
            Customer.name.label("customer_name"),
            Barber.display_name.label("barber_name"),
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            Invoice.total_amount,
            Invoice.payment_method,
            Invoice.points_added,
            Invoice.issued_at,
        )
        .join(ServiceSession, ServiceSession.id == Invoice.session_id)
        .join(Customer, Customer.id == ServiceSession.customer_id)
        .join(Barber, Barber.id == ServiceSession.barber_id)
        .join(Service, Service.id == ServiceSession.service_id)
    )

    if service_id:
        query = query.filter(Service.id == service_id)

    if payment_method:
        query = query.filter(Invoice.payment_method == payment_method)

    if start_date:
        query = query.filter(Invoice.issued_at >= datetime.combine(start_date, time.min))

    if end_date:
        query = query.filter(Invoice.issued_at <= datetime.combine(end_date, time.max))

    if search:
        value = f"%{search}%"
        query = query.filter(
            or_(
                Invoice.invoice_no.ilike(value),
                Customer.name.ilike(value),
                Barber.display_name.ilike(value),
                Service.name.ilike(value),
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
            "session_id": row.session_id,
            "customer_name": row.customer_name,
            "barber_name": row.barber_name,
            "service_name": row.service_name,
            "total_amount": float(row.total_amount or 0),
            "payment_method": row.payment_method,
            "points_added": int(row.points_added or 0),
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