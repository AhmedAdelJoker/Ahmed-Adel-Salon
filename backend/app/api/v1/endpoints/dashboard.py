from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import (
    require_owner_or_manager,
    require_cashier_manager_owner,
    require_any_staff,
)
from app.models.user import User
from app.models.customer import Customer
from app.models.appointment import Appointment
from app.models.service_session import ServiceSession
from app.models.product import Product
from app.models.invoice import Invoice
from app.models.notification import Notification

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _sum_invoice_total(invoices):
    total = 0
    for invoice in invoices:
        total += float(invoice.total_amount or 0)
    return total


@router.get("/owner-summary")
def owner_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    customers_count = db.query(Customer).count()
    appointments_count = db.query(Appointment).count()
    sessions_count = db.query(ServiceSession).count()
    products_count = db.query(Product).count()
    invoices = db.query(Invoice).all()
    invoices_count = len(invoices)

    notifications_count = (
        db.query(Notification)
        .filter(Notification.user_role == "owner", Notification.is_read == False)
        .count()
    )

    return {
        "customersCount": customers_count,
        "appointmentsCount": appointments_count,
        "sessionsCount": sessions_count,
        "productsCount": products_count,
        "invoicesCount": invoices_count,
        "notificationsCount": notifications_count,
        "totalRevenue": _sum_invoice_total(invoices),
    }


@router.get("/manager-summary")
def manager_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    appointments_count = db.query(Appointment).count()
    sessions = db.query(ServiceSession).all()
    products_count = db.query(Product).count()
    invoices = db.query(Invoice).all()

    notifications_count = (
        db.query(Notification)
        .filter(Notification.user_role == "manager", Notification.is_read == False)
        .count()
    )

    return {
        "appointmentsCount": appointments_count,
        "activeSessionsCount": len([s for s in sessions if s.status != "completed"]),
        "productsCount": products_count,
        "notificationsCount": notifications_count,
        "totalRevenue": _sum_invoice_total(invoices),
    }


@router.get("/cashier-summary")
def cashier_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    customers_count = db.query(Customer).count()
    appointments_count = db.query(Appointment).count()
    invoices = db.query(Invoice).all()
    products = db.query(Product).all()

    low_stock_count = len(
        [
            p
            for p in products
            if float(p.quantity or 0) <= float(p.min_quantity_alert or 0)
        ]
    )

    notifications_count = (
        db.query(Notification)
        .filter(Notification.user_role == "cashier", Notification.is_read == False)
        .count()
    )

    return {
        "customersCount": customers_count,
        "appointmentsCount": appointments_count,
        "invoicesCount": len(invoices),
        "lowStockCount": low_stock_count,
        "notificationsCount": notifications_count,
        "todayRevenue": _sum_invoice_total(invoices),
    }


@router.get("/barber-summary")
def barber_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    if current_user.role != "barber" or not current_user.barber_id:
        return {
            "appointmentsCount": 0,
            "sessionsCount": 0,
            "completedSessionsCount": 0,
            "isCheckedIn": False,
        }

    appointments = (
        db.query(Appointment)
        .filter(Appointment.barber_id == current_user.barber_id)
        .all()
    )

    sessions = (
        db.query(ServiceSession)
        .filter(ServiceSession.barber_id == current_user.barber_id)
        .all()
    )

    return {
        "appointmentsCount": len(appointments),
        "sessionsCount": len(sessions),
        "completedSessionsCount": len(
            [s for s in sessions if s.status == "completed"]
        ),
        "isCheckedIn": True,
    }