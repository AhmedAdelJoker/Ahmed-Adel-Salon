from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import Any, Dict

from app.api import deps
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.appointment import Appointment
from app.models.pos_shift import PosShift

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/owner-summary")
def get_owner_summary(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_owner),
) -> Any:
    """
    Get high-level stats for the Owner Dashboard.
    """
    today = date.today()
    start_of_today = datetime.combine(today, datetime.min.time())
    end_of_today = datetime.combine(today, datetime.max.time())
    first_day_of_month = today.replace(day=1)
    start_of_month = datetime.combine(first_day_of_month, datetime.min.time())
    
    # Revenue (Monthly)
    monthly_revenue = db.query(func.sum(Invoice.final_amount)).filter(
        Invoice.created_at >= start_of_month
    ).scalar() or 0
    
    # Today's performance
    today_revenue = db.query(func.sum(Invoice.final_amount)).filter(
        Invoice.created_at >= start_of_today,
        Invoice.created_at <= end_of_today
    ).scalar() or 0
    
    today_invoices_count = db.query(func.count(Invoice.id)).filter(
        Invoice.created_at >= start_of_today,
        Invoice.created_at <= end_of_today
    ).scalar() or 0
    
    today_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_date == today
    ).scalar() or 0

    # New Customers Today
    new_customers_today = db.query(func.count(Customer.customer_id)).filter(
        Customer.created_at >= start_of_today,
        Customer.created_at <= end_of_today
    ).scalar() or 0

    average_invoice_value = today_revenue / today_invoices_count if today_invoices_count > 0 else 0

    # Revenue Growth (vs previous month)
    last_month_start = (first_day_of_month - timedelta(days=1)).replace(day=1)
    last_month_end = first_day_of_month - timedelta(seconds=1)
    
    prev_month_revenue = db.query(func.sum(Invoice.final_amount)).filter(
        Invoice.created_at >= last_month_start,
        Invoice.created_at <= last_month_end
    ).scalar() or 0
    
    growth_pct = 0
    if prev_month_revenue > 0:
        growth_pct = ((float(monthly_revenue) - float(prev_month_revenue)) / float(prev_month_revenue)) * 100

    return {
        "monthly_revenue": float(monthly_revenue),
        "today_revenue": float(today_revenue),
        "today_appointments": today_appointments,
        "new_customers_today": new_customers_today,
        "average_invoice_value": float(average_invoice_value),
        "revenue_target": 50000.0,
        "revenue_growth": f"{growth_pct:+.1f}%",
    }


@router.get("/manager-summary")
def get_manager_summary(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_owner_or_manager),
) -> Any:
    """
    Get operational stats for the Manager Dashboard.
    """
    today = date.today()
    
    # Active Employees (replacing Barber)
    active_employees_count = db.query(func.count(Employee.id)).filter(Employee.is_active == True).scalar() or 0
    
    # Today's Appointments
    today_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_date == today
    ).scalar() or 0
    
    # Open Shifts
    open_shifts_count = db.query(func.count(PosShift.id)).filter(
        PosShift.status == "open"
    ).scalar() or 0
    
    # Pending Discounts
    from app.models.discount_approval_request import DiscountApprovalRequest
    pending_discounts = db.query(func.count(DiscountApprovalRequest.id)).filter(
        DiscountApprovalRequest.status == "pending"
    ).scalar() or 0
    
    return {
        "active_barbers": active_employees_count,
        "today_appointments": today_appointments,
        "open_shifts": open_shifts_count,
        "pending_discounts": pending_discounts,
        "operational_efficiency": "95%",
    }

@router.get("/cashier-summary")
def get_cashier_summary(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_cashier_manager_owner),
) -> Any:
    """
    Get stats for the Cashier Dashboard.
    """
    today = date.today()
    start_of_today = datetime.combine(today, datetime.min.time())
    
    # Current Shift
    current_shift = db.query(PosShift).filter(
        PosShift.cashier_user_id == current_user.id,
        PosShift.status == "open"
    ).order_by(PosShift.id.desc()).first()
    
    # Today's Personal Sales
    today_sales = db.query(func.sum(Invoice.final_amount)).filter(
        Invoice.created_by_user_id == current_user.id,
        Invoice.created_at >= start_of_today
    ).scalar() or 0
    
    # Today's Queue (Walk-ins)
    from app.models.walk_in_queue import WalkInQueue
    waiting_count = db.query(func.count(WalkInQueue.id)).filter(
        WalkInQueue.status == "waiting",
        WalkInQueue.arrived_at >= start_of_today
    ).scalar() or 0

    # Today's Appointments Count
    today_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_date == today
    ).scalar() or 0

    # Total Customers
    customers_count = db.query(func.count(Customer.customer_id)).scalar() or 0

    # Low Stock Items
    from app.models.product import Product
    low_stock_count = db.query(func.count(Product.id)).filter(
        Product.quantity <= Product.min_quantity_alert
    ).scalar() or 0

    # Personal Invoices Count
    invoices_count = db.query(func.count(Invoice.id)).filter(
        Invoice.created_by_user_id == current_user.id,
        Invoice.created_at >= start_of_today
    ).scalar() or 0

    # Today's Expenses
    today_expenses = db.query(func.sum(Expense.amount)).filter(
        Expense.created_at >= start_of_today
    ).scalar() or 0

    # Present Employees Count (Latest status today is 'in')
    from app.models.employee_presence_log import EmployeePresenceLog
    from sqlalchemy import and_
    
    # Subquery to get the latest log ID for each employee today
    latest_log_ids = db.query(
        func.max(EmployeePresenceLog.id)
    ).filter(
        EmployeePresenceLog.created_at >= start_of_today
    ).group_by(
        EmployeePresenceLog.employee_id
    ).all()
    
    latest_log_ids = [id_tuple[0] for id_tuple in latest_log_ids]
    
    present_employees_count = db.query(func.count(EmployeePresenceLog.id)).filter(
        EmployeePresenceLog.id.in_(latest_log_ids),
        EmployeePresenceLog.status == "in"
    ).scalar() or 0

    return {
        "has_open_shift": current_shift is not None,
        "current_shift_id": current_shift.id if current_shift else None,
        "today_sales": float(today_sales),
        "today_expenses": float(today_expenses),
        "present_employees_count": present_employees_count,
        "waiting_customers": waiting_count,
        "today_appointments": today_appointments,
        "customers_count": customers_count,
        "low_stock_count": low_stock_count,
        "invoices_count": invoices_count,
        "active_notifications": 0,
    }



