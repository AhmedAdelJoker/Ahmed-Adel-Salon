from datetime import datetime, time
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.service_session import ServiceSession
from app.models.barber import Barber
from app.models.service import Service
from app.models.activity_log import ActivityLog
from app.models.notification import Notification
from app.models.customer import Customer


def get_dashboard_widgets(
    db: Session,
    user_id: int,
    *,
    start_date=None,
    end_date=None,
    payment_method: str | None = None,
    service_id: int | None = None,
    barber_id: int | None = None,
):
    # Unread notifications
    unread_notifications = int(
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .scalar()
        or 0
    )
    # Completed unpaid sessions
    completed_unpaid = int(
        db.query(func.count(ServiceSession.id))
        .filter(ServiceSession.status == "completed")
        .scalar()
        or 0
    )
    # Latest invoices with filters
    latest_invoices_query = (
        db.query(
            Invoice.id,
            Invoice.invoice_no,
            Invoice.total_amount,
            Invoice.created_at.label("issued_at"),
            Customer.first_name.label("customer_name"),
        )
        .join(Customer, Customer.customer_id == Invoice.customer_id)
    )

    if start_date:
        latest_invoices_query = latest_invoices_query.filter(
            Invoice.created_at >= datetime.combine(start_date, time.min)
        )
    if end_date:
        latest_invoices_query = latest_invoices_query.filter(
            Invoice.created_at <= datetime.combine(end_date, time.max)
        )
    if payment_method:
        latest_invoices_query = latest_invoices_query.filter(
            Invoice.payment_method == payment_method
        )
    if barber_id:
        latest_invoices_query = latest_invoices_query.filter(
            Invoice.barber_id == barber_id
        )

    latest_invoices = (
        latest_invoices_query.order_by(Invoice.id.desc()).limit(5).all()
    )
    # Latest activities
    latest_activities = (
        db.query(ActivityLog)
        .order_by(ActivityLog.id.desc())
        .limit(5)
        .all()
    )
    # Top barber
    top_barber_query = (
        db.query(
            Barber.display_name.label("barber_name"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("total_revenue"),
        )
        .join(Invoice, Invoice.barber_id == Barber.id)
    )

    if start_date:
        top_barber_query = top_barber_query.filter(
            Invoice.created_at >= datetime.combine(start_date, time.min)
        )
    if end_date:
        top_barber_query = top_barber_query.filter(
            Invoice.created_at <= datetime.combine(end_date, time.max)
        )
    if payment_method:
        top_barber_query = top_barber_query.filter(
            Invoice.payment_method == payment_method
        )
    if barber_id:
        top_barber_query = top_barber_query.filter(
            Invoice.barber_id == barber_id
        )

    top_barber = (
        top_barber_query
        .group_by(Barber.display_name)
        .order_by(func.coalesce(func.sum(Invoice.total_amount), 0).desc())
        .first()
    )

    
    # Top service
    from app.models.invoice_item import InvoiceItem
    top_service_query = (
        db.query(
            InvoiceItem.service_name.label("service_name"),
            func.coalesce(func.sum(InvoiceItem.total_price), 0).label("total_revenue"),
        )
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
    )

    if start_date:
        top_service_query = top_service_query.filter(
            Invoice.created_at >= datetime.combine(start_date, time.min)
        )
    if end_date:
        top_service_query = top_service_query.filter(
            Invoice.created_at <= datetime.combine(end_date, time.max)
        )
    if payment_method:
        top_service_query = top_service_query.filter(
            Invoice.payment_method == payment_method
        )
    if barber_id:
        top_service_query = top_service_query.filter(
            Invoice.barber_id == barber_id
        )

    top_service = (
        top_service_query
        .group_by(InvoiceItem.service_name)
        .order_by(func.coalesce(func.sum(InvoiceItem.total_price), 0).desc())
        .first()
    )

    return {
        "unread_notifications": unread_notifications,
        "completed_unpaid": completed_unpaid,
        "latest_invoices": [
            {
                "id": row.id,
                "invoice_no": row.invoice_no,
                "customer_name": row.customer_name,
                "total_amount": float(row.total_amount or 0),
                "issued_at": row.issued_at,
            }
            for row in latest_invoices
        ],
        "latest_activities": [
            {
                "id": row.id,
                "action": row.action,
                "description": row.description,
                "created_at": row.created_at,
            }
            for row in latest_activities
        ],
        "top_barber": {
            "barber_name": top_barber.barber_name if top_barber else None,
            "total_revenue": float(top_barber.total_revenue or 0) if top_barber else 0,
        },
        "top_service": {
            "service_name": top_service.service_name if top_service else None,
            "total_revenue": float(top_service.total_revenue or 0) if top_service else 0,
        },
    }