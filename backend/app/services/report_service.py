from datetime import datetime, time
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.service_session import ServiceSession
from app.models.customer import Customer
from app.models.barber import Barber
from app.models.service import Service


def _build_invoice_filters(
    start_date=None,
    end_date=None,
    payment_method=None,
    service_id=None,
    barber_id=None,
    search=None,
):
    filters = []

    if start_date:
        filters.append(Invoice.issued_at >= datetime.combine(start_date, time.min))

    if end_date:
        filters.append(Invoice.issued_at <= datetime.combine(end_date, time.max))

    if payment_method:
        filters.append(Invoice.payment_method == payment_method)

    if service_id:
        filters.append(Service.id == service_id)

    if barber_id:
        filters.append(Barber.id == barber_id)

    if search:
        value = f"%{search}%"
        filters.append(
            or_(
                Invoice.invoice_no.ilike(value),
                Customer.name.ilike(value),
                Barber.display_name.ilike(value),
                Service.name.ilike(value),
            )
        )

    return filters


def get_report_overview(
    db: Session,
    start_date=None,
    end_date=None,
    payment_method=None,
    service_id=None,
    barber_id=None,
    search=None,
):
    invoice_filters = _build_invoice_filters(
        start_date,
        end_date,
        payment_method,
        service_id,
        barber_id,
        search,
    )

    invoice_base = (
        db.query(Invoice)
        .join(ServiceSession, ServiceSession.id == Invoice.session_id)
        .join(Customer, Customer.id == ServiceSession.customer_id)
        .join(Barber, Barber.id == ServiceSession.barber_id)
        .join(Service, Service.id == ServiceSession.service_id)
    )

    filtered_invoices_query = invoice_base.filter(*invoice_filters)

    total_revenue = float(
        filtered_invoices_query.with_entities(
            func.coalesce(func.sum(Invoice.total_amount), 0)
        ).scalar()
        or 0
    )

    total_invoices = int(
        filtered_invoices_query.with_entities(func.count(Invoice.id)).scalar() or 0
    )

    average_invoice = float(total_revenue / total_invoices) if total_invoices else 0

    completed_unpaid = int(
        db.query(func.count(ServiceSession.id))
        .filter(ServiceSession.status == "completed")
        .scalar()
        or 0
    )

    done_sessions = int(
        db.query(func.count(ServiceSession.id))
        .filter(ServiceSession.status == "done")
        .scalar()
        or 0
    )

    payment_methods_rows = (
        invoice_base.with_entities(
            Invoice.payment_method,
            func.count(Invoice.id).label("count"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("total_amount"),
        )
        .filter(*invoice_filters)
        .group_by(Invoice.payment_method)
        .all()
    )

    top_barbers_rows = (
        invoice_base.with_entities(
            Barber.id.label("barber_id"),
            Barber.display_name.label("barber_name"),
            func.count(ServiceSession.id).label("sessions_count"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("total_revenue"),
        )
        .filter(*invoice_filters)
        .group_by(Barber.id, Barber.display_name)
        .order_by(func.coalesce(func.sum(Invoice.total_amount), 0).desc())
        .limit(10)
        .all()
    )

    top_services_rows = (
        invoice_base.with_entities(
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            func.count(ServiceSession.id).label("sessions_count"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("total_revenue"),
        )
        .filter(*invoice_filters)
        .group_by(Service.id, Service.name)
        .order_by(func.coalesce(func.sum(Invoice.total_amount), 0).desc())
        .limit(10)
        .all()
    )

    recent_invoices_rows = (
        invoice_base.with_entities(
            Invoice.id,
            Invoice.invoice_no,
            Customer.name.label("customer_name"),
            Barber.id.label("barber_id"),
            Barber.display_name.label("barber_name"),
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            Invoice.payment_method,
            Invoice.total_amount,
            Invoice.issued_at,
        )
        .filter(*invoice_filters)
        .order_by(Invoice.id.desc())
        .limit(100)
        .all()
    )

    return {
        "total_revenue": total_revenue,
        "total_invoices": total_invoices,
        "completed_unpaid": completed_unpaid,
        "done_sessions": done_sessions,
        "average_invoice": average_invoice,
        "payment_methods": [
            {
                "payment_method": row.payment_method,
                "count": int(row.count),
                "total_amount": float(row.total_amount or 0),
            }
            for row in payment_methods_rows
        ],
        "top_barbers": [
            {
                "barber_id": row.barber_id,
                "barber_name": row.barber_name,
                "sessions_count": int(row.sessions_count),
                "total_revenue": float(row.total_revenue or 0),
            }
            for row in top_barbers_rows
        ],
        "top_services": [
            {
                "service_id": row.service_id,
                "service_name": row.service_name,
                "sessions_count": int(row.sessions_count),
                "total_revenue": float(row.total_revenue or 0),
            }
            for row in top_services_rows
        ],
        "recent_invoices": [
            {
                "id": row.id,
                "invoice_no": row.invoice_no,
                "customer_name": row.customer_name,
                "barber_id": row.barber_id,
                "barber_name": row.barber_name,
                "service_id": row.service_id,
                "service_name": row.service_name,
                "payment_method": row.payment_method,
                "total_amount": float(row.total_amount or 0),
                "issued_at": row.issued_at,
            }
            for row in recent_invoices_rows
        ],
    }