from datetime import datetime, time, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.appointment import Appointment

router = APIRouter(prefix="/owner", tags=["Owner Reports"])


@router.get("/dashboard-stats")
def get_dashboard_stats(
    scope: str = Query("today"),
    employee_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # Set date filters based on scope
    today = datetime.now().date()
    end_date = datetime.combine(today, time.max)

    if scope == "today":
        start_date = datetime.combine(today, time.min)
    elif scope == "yesterday":
        yesterday = today - timedelta(days=1)
        start_date = datetime.combine(yesterday, time.min)
        end_date = datetime.combine(yesterday, time.max)
    elif scope == "week":
        start_date = datetime.combine(today - timedelta(days=7), time.min)
    elif scope == "month":
        start_date = datetime.combine(today - timedelta(days=30), time.min)
    elif scope == "year":
        start_date = datetime.combine(today - timedelta(days=365), time.min)
    else:
        # Default: today
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
    # Calculate revenue for the current calendar month
    month_start = datetime.combine(today.replace(day=1), time.min)
    month_rev_query = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.created_at >= month_start,
        Invoice.created_at <= datetime.combine(today, time.max)
    )
    if employee_id:
        month_rev_query = month_rev_query.filter(Invoice.barber_id == employee_id)
    month_revenue = float(month_rev_query.scalar() or 0)

    # Target goal (e.g. 50,000 EGP)
    revenue_target = 50000.0
    month_goal = min(int((month_revenue / revenue_target) * 100), 100)

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

        weekly_data.append({
            "name": day_name_ar,
            "revenue": day_revenue
        })

    return {
        "stats": {
            "todayRevenue": today_revenue,
            "todayExpenses": today_expenses,
            "netProfit": net_profit,
            "todayAppointments": today_appointments,
            "avgInvoice": avg_invoice,
            "monthGoal": month_goal,
        },
        "weekly_data": weekly_data,
    }
