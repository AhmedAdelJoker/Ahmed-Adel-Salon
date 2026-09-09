from fastapi import APIRouter, Query, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.service import Service
from app.models.service_session import ServiceSession
from app.models.user import User
from app.schemas.report import (
    PaymentMethodBreakdownRead,
    ReportOverviewRead,
    TopBarberRead,
    TopServiceRead,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/overview", response_model=ReportOverviewRead)
def reports_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager", "owner")),
):
    total_revenue = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).scalar() or 0
    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0
    done_sessions = (
        db.query(func.count(ServiceSession.id))
        .filter(ServiceSession.status.in_(["completed", "completed_unpaid", "checked_out"]))
        .scalar()
        or 0
    )

    average_invoice = float(total_revenue) / int(total_invoices) if total_invoices else 0

    # NOTE: ServiceSession has no service_id and Invoice has no session_id,
    # so top services are aggregated from sold invoice items instead.
    top_services_rows = (
        db.query(
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            func.count(InvoiceItem.id).label("sessions_count"),
            func.coalesce(func.sum(InvoiceItem.total_price), 0).label("total_revenue"),
        )
        .join(InvoiceItem, InvoiceItem.service_id == Service.id, isouter=True)
        .group_by(Service.id, Service.name)
        .order_by(func.coalesce(func.sum(InvoiceItem.total_price), 0).desc())
        .limit(5)
        .all()
    )

    # NOTE: revenue per barber comes from Invoice.barber_id; aggregated
    # separately to avoid fan-out between sessions and invoices.
    sessions_per_barber = dict(
        db.query(ServiceSession.barber_id, func.count(ServiceSession.id))
        .group_by(ServiceSession.barber_id)
        .all()
    )
    revenue_per_barber = dict(
        db.query(Invoice.barber_id, func.coalesce(func.sum(Invoice.total_amount), 0))
        .filter(Invoice.barber_id.isnot(None))
        .group_by(Invoice.barber_id)
        .all()
    )
    top_barbers_rows = sorted(
        (
            {
                "barber_id": emp_id,
                "barber_name": emp_name,
                "sessions_count": int(sessions_per_barber.get(emp_id, 0)),
                "total_revenue": float(revenue_per_barber.get(emp_id, 0) or 0),
            }
            for emp_id, emp_name in db.query(Employee.id, Employee.full_name).all()
        ),
        key=lambda r: r["total_revenue"],
        reverse=True,
    )[:5]

    payment_methods_rows = (
        db.query(
            Invoice.payment_method.label("payment_method"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("total_amount"),
        )
        .group_by(Invoice.payment_method)
        .all()
    )

    return ReportOverviewRead(
        total_revenue=float(total_revenue),
        total_invoices=int(total_invoices),
        average_invoice=float(average_invoice),
        done_sessions=int(done_sessions),
        top_services=[
            TopServiceRead(
                service_id=row.service_id,
                service_name=row.service_name,
                sessions_count=int(row.sessions_count or 0),
                total_revenue=float(row.total_revenue or 0),
            )
            for row in top_services_rows
        ],
        top_barbers=[
            TopBarberRead(
                barber_id=row["barber_id"],
                barber_name=row["barber_name"],
                sessions_count=int(row["sessions_count"] or 0),
                total_revenue=float(row["total_revenue"] or 0),
            )
            for row in top_barbers_rows
        ],
        payment_methods=[
            PaymentMethodBreakdownRead(
                payment_method=row.payment_method,
                total_amount=float(row.total_amount or 0),
            )
            for row in payment_methods_rows
        ],
    )