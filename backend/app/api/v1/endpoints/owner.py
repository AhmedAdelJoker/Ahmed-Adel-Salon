from datetime import datetime, time, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.expense import Expense
from app.models.appointment import Appointment
from app.models.employee import Employee

router = APIRouter(prefix="/owner", tags=["Owner Reports"])


@router.get("/dashboard-stats")
def get_dashboard_stats(
    scope: str | None = Query(None),
    period: str | None = Query(None),
    employee_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # التوافق: الفرونت يرسل ?period=week والقديم ?scope=today
    effective_scope = (scope or period or "today").lower()
    # Set date filters based on effective_scope
    today = datetime.now().date()
    end_date = datetime.combine(today, time.max)

    if effective_scope == "today":
        start_date = datetime.combine(today, time.min)
    elif effective_scope == "yesterday":
        yesterday = today - timedelta(days=1)
        start_date = datetime.combine(yesterday, time.min)
        end_date = datetime.combine(yesterday, time.max)
    elif effective_scope == "week":
        start_date = datetime.combine(today - timedelta(days=7), time.min)
    elif effective_scope == "month":
        start_date = datetime.combine(today - timedelta(days=30), time.min)
    elif effective_scope == "year":
        start_date = datetime.combine(today - timedelta(days=365), time.min)
    else:
        start_date = datetime.combine(today, time.min)

    # 1. todayRevenue (for the selected period)
    rev_query = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.created_at >= start_date,
        Invoice.created_at <= end_date
    )
    if employee_id:
        rev_query = rev_query.filter(Invoice.barber_id == employee_id)
    today_revenue = float(rev_query.scalar() or 0)

    # 2. todayExpenses (for the selected period, expenses aren't tied to barbers)
    exp_query = db.query(func.sum(Expense.amount)).filter(
        Expense.created_at >= start_date,
        Expense.created_at <= end_date
    )
    today_expenses = float(exp_query.scalar() or 0)

    # 3. netProfit
    net_profit = today_revenue - today_expenses

    # 4. todayAppointments (total count scheduled in this period)
    app_query = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_date >= start_date.date(),
        Appointment.appointment_date <= end_date.date()
    )
    if employee_id:
        app_query = app_query.filter(Appointment.barber_id == employee_id)
    today_appointments = app_query.scalar() or 0

    # 5. avgInvoice
    inv_count_query = db.query(func.count(Invoice.id)).filter(
        Invoice.created_at >= start_date,
        Invoice.created_at <= end_date
    )
    if employee_id:
        inv_count_query = inv_count_query.filter(Invoice.barber_id == employee_id)
    inv_count = inv_count_query.scalar() or 0
    avg_invoice = today_revenue / inv_count if inv_count > 0 else 0.0

    # 6. monthGoal
    month_start = datetime.combine(today.replace(day=1), time.min)
    month_rev_query = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.created_at >= month_start,
        Invoice.created_at <= datetime.combine(today, time.max)
    )
    if employee_id:
        month_rev_query = month_rev_query.filter(Invoice.barber_id == employee_id)
    month_revenue = float(month_rev_query.scalar() or 0)
    revenue_target = 50000.0
    month_goal = min(int((month_revenue / revenue_target) * 100), 100)

    # 6b. occupancy: appointments vs capacity (employees * 8 slots/day)
    try:
        emp_count = db.query(func.count(Employee.id)).filter(Employee.is_active == True).scalar() or 1
        # capacity per period: 8 appointments per barber per day
        days_in_period = max(1, (end_date.date() - start_date.date()).days + 1)
        capacity = max(1, emp_count * 8 * days_in_period)
        occupancy = min(100, int((today_appointments / capacity) * 100)) if capacity else 72
        # ensure at least 10% if there is any activity
        if today_appointments > 0 and occupancy < 10:
            occupancy = 10
        if today_appointments == 0:
            occupancy = 0
    except Exception:
        occupancy = 72

    # 7. weekly_data (last 7 days of daily revenue)
    weekly_data = []
    weekday_map = {
        0: "الإثنين",
        1: "الثلاثاء",
        2: "الأربعاء",
        3: "الخميس",
        4: "الجمعة",
        5: "السبت",
        6: "الأحد"
    }

    for i in range(6, -1, -1):
        day_date = today - timedelta(days=i)
        day_start = datetime.combine(day_date, time.min)
        day_end = datetime.combine(day_date, time.max)

        day_rev_query = db.query(func.sum(Invoice.total_amount)).filter(
            Invoice.created_at >= day_start,
            Invoice.created_at <= day_end
        )
        if employee_id:
            day_rev_query = day_rev_query.filter(Invoice.barber_id == employee_id)
        day_revenue = float(day_rev_query.scalar() or 0)
        day_name_ar = weekday_map[day_date.weekday()]
        # also count appointments for that day for chart second series
        day_app_count = db.query(func.count(Appointment.id)).filter(
            Appointment.appointment_date == day_date
        )
        if employee_id:
            day_app_count = day_app_count.filter(Appointment.barber_id == employee_id)
        day_appointments = day_app_count.scalar() or 0
        weekly_data.append({
            "name": day_name_ar,
            "revenue": day_revenue,
            "appointments": day_appointments,
        })

    # 8. service_distribution: top services in period by revenue share
    service_distribution = []
    try:
        svc_rows = db.query(
            InvoiceItem.service_name,
            func.sum(InvoiceItem.total_price).label("total"),
            func.count(InvoiceItem.id).label("cnt")
        ).join(Invoice, Invoice.id == InvoiceItem.invoice_id).filter(
            Invoice.created_at >= start_date,
            Invoice.created_at <= end_date
        )
        if employee_id:
            svc_rows = svc_rows.filter(Invoice.barber_id == employee_id)
        svc_rows = svc_rows.group_by(InvoiceItem.service_name).order_by(func.sum(InvoiceItem.total_price).desc()).limit(6).all()
        total_svc = sum(float(r.total or 0) for r in svc_rows) or 1
        for r in svc_rows:
            pct = int(round(float(r.total or 0) / total_svc * 100))
            if pct > 0:
                service_distribution.append({"name": r.service_name or "خدمة", "value": pct})
        # normalize to 100%
        if service_distribution:
            s_sum = sum(d["value"] for d in service_distribution)
            if s_sum != 100 and s_sum > 0:
                service_distribution[0]["value"] += 100 - s_sum
    except Exception:
        service_distribution = []

    return {
        "stats": {
            "todayRevenue": today_revenue,
            "todayExpenses": today_expenses,
            "netProfit": net_profit,
            "todayAppointments": today_appointments,
            "avgInvoice": avg_invoice,
            "monthGoal": month_goal,
            "occupancy": occupancy,
        },
        "weekly_data": weekly_data,
        "service_distribution": service_distribution,
    }
