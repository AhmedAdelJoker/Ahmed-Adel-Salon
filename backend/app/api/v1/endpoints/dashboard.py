from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

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
from app.models.employee import Employee
from app.models.expense import Expense
from app.models.pos_shift import PosShift
from app.models.employee_presence_log import EmployeePresenceLog

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
    customers_count = db.query(Customer).filter(Customer.is_deleted == False).count()
    appointments_count = db.query(Appointment).count()
    sessions_count = db.query(ServiceSession).count()
    products_count = db.query(Product).count()
    # Drafts are not sales: exclude from revenue/count aggregates
    invoices = db.query(Invoice).filter(Invoice.is_draft == False).all()
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
    # Drafts are not sales: exclude from revenue aggregates
    invoices = db.query(Invoice).filter(Invoice.is_draft == False).all()

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
    from datetime import date, datetime, time
    today_start = datetime.combine(date.today(), time.min)
    today_end = datetime.combine(date.today(), time.max)

    customers_count = db.query(Customer).filter(Customer.is_deleted == False).count()
    
    # Today's appointments
    today_appointments = db.query(Appointment).filter(
        Appointment.appointment_date == date.today()
    ).count()
    
    # Daily Cancellations
    today_cancellations = db.query(Appointment).filter(
        Appointment.appointment_date == date.today(),
        Appointment.status.in_(["cancelled", "auto_cancelled"])
    ).count()
    
    cancellation_rate = 0
    if today_appointments > 0:
        cancellation_rate = (today_cancellations / today_appointments) * 100

    # Today's invoices (drafts are not sales)
    today_invoices = db.query(Invoice).filter(
        Invoice.created_at >= today_start, Invoice.created_at <= today_end,
        Invoice.is_draft == False,
    ).all()
    
    # Today's total sales
    today_sales = _sum_invoice_total(today_invoices)
    
    # Today's expenses
    today_expenses_result = db.query(sql_func.coalesce(sql_func.sum(Expense.amount), 0)).filter(
        Expense.created_at >= today_start, Expense.created_at <= today_end
    ).scalar()
    today_expenses = float(today_expenses_result or 0)

    # Low stock count
    products = db.query(Product).all()
    low_stock_count = len(
        [
            p
            for p in products
            if float(p.quantity or 0) <= float(p.min_quantity_alert or 0)
        ]
    )

    # Notifications count
    notifications_count = (
        db.query(Notification)
        .filter(Notification.user_role == "cashier", Notification.is_read == False)
        .count()
    )

    # Current shift info
    current_shift = db.query(PosShift).filter(
        PosShift.status.in_(["open", "opened"]),
        PosShift.user_id == current_user.id,
    ).order_by(PosShift.opened_at.desc()).first()
    
    has_open_shift = current_shift is not None
    current_shift_id = current_shift.id if current_shift else None

    # Present employees count (checked in today via presence logs)
    present_employees_count = db.query(EmployeePresenceLog.employee_id).filter(
        EmployeePresenceLog.created_at >= today_start,
        EmployeePresenceLog.status.in_(["present", "checked_in", "active"])
    ).distinct().count()

    # Waiting customers (appointments with waiting/pending/confirmed status for today)
    waiting_customers = db.query(Appointment).filter(
        Appointment.appointment_date == date.today(),
        Appointment.status.in_(["waiting", "pending", "confirmed"])
    ).count()

    return {
        "customers_count": customers_count,
        "today_appointments": today_appointments,
        "invoices_count": len(today_invoices),
        "low_stock_count": low_stock_count,
        "active_notifications": notifications_count,
        "today_sales": float(today_sales),
        "today_expenses": today_expenses,
        "todayCancellationsCount": today_cancellations,
        "cancellationRate": round(cancellation_rate, 2),
        "has_open_shift": has_open_shift,
        "current_shift_id": current_shift_id,
        "present_employees_count": present_employees_count,
        "waiting_customers": waiting_customers,
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