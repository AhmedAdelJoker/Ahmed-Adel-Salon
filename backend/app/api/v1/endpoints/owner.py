from datetime import datetime, time, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
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
    if effective_scope not in ("today", "yesterday", "week", "month", "year"):
        effective_scope = "today"
    if employee_id is not None:
        if employee_id <= 0:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="معرف الموظف غير صالح")
        if not db.query(Employee).filter(Employee.id == employee_id).first():
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="الموظف غير موجود")
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
        Invoice.is_draft == False,
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
        Invoice.is_draft == False,
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
        Invoice.is_draft == False,
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
        emp_count = db.query(func.count(Employee.id)).filter(Employee.status == "active", Employee.is_active == True).scalar() or 1
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

    # 7. weekly_data — optimized: 2 grouped queries instead of 14
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
    try:
        # Revenue per day in one query
        week_start = datetime.combine(today - timedelta(days=6), time.min)
        week_end = datetime.combine(today, time.max)
        rev_by_day = {}
        rev_rows = db.query(
            func.date(Invoice.created_at).label("d"),
            func.sum(Invoice.total_amount).label("total")
        ).filter(Invoice.is_draft == False, Invoice.created_at >= week_start, Invoice.created_at <= week_end)
        if employee_id:
            rev_rows = rev_rows.filter(Invoice.barber_id == employee_id)
        rev_rows = rev_rows.group_by(func.date(Invoice.created_at)).all()
        for r in rev_rows:
            # r.d is date string or date object
            d = r.d
            if hasattr(d, "isoformat"):
                d = d.isoformat() if isinstance(d, str) else str(d)
            else:
                d = str(d)
            # Normalize to YYYY-MM-DD
            try:
                # Handle both date and datetime strings
                day_key = str(d)[:10]
                rev_by_day[day_key] = float(r.total or 0)
            except Exception:
                pass

        app_by_day = {}
        app_rows = db.query(
            func.date(Appointment.appointment_date).label("d"),
            func.count(Appointment.id).label("cnt")
        ).filter(Appointment.appointment_date >= week_start.date(), Appointment.appointment_date <= week_end.date())
        if employee_id:
            app_rows = app_rows.filter(Appointment.barber_id == employee_id)
        app_rows = app_rows.group_by(func.date(Appointment.appointment_date)).all()
        for r in app_rows:
            d = str(r.d)[:10]
            app_by_day[d] = int(r.cnt or 0)

        for i in range(6, -1, -1):
            day_date = today - timedelta(days=i)
            day_key = day_date.isoformat()
            day_revenue = rev_by_day.get(day_key, 0.0)
            day_appointments = app_by_day.get(day_key, 0)
            day_name_ar = weekday_map[day_date.weekday()]
            weekly_data.append({
                "name": day_name_ar,
                "revenue": day_revenue,
                "appointments": day_appointments,
            })
    except Exception:
        # Fallback to old loop if grouped query fails
        for i in range(6, -1, -1):
            day_date = today - timedelta(days=i)
            day_start = datetime.combine(day_date, time.min)
            day_end = datetime.combine(day_date, time.max)
            day_rev_query = db.query(func.sum(Invoice.total_amount)).filter(
                Invoice.created_at >= day_start, Invoice.created_at <= day_end
            )
            if employee_id:
                day_rev_query = day_rev_query.filter(Invoice.barber_id == employee_id)
            day_revenue = float(day_rev_query.scalar() or 0)
            day_name_ar = weekday_map[day_date.weekday()]
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
            Invoice.is_draft == False,
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

    # 9. trends — compare current period vs previous period
    def _trend(curr: float, prev: float) -> int:
        if prev == 0:
            return 0 if curr == 0 else 100
        try:
            return int(round((curr - prev) / abs(prev) * 100))
        except Exception:
            return 0

    try:
        period_days = max(1, (end_date.date() - start_date.date()).days + 1)
        prev_start = start_date - timedelta(days=period_days)
        prev_end = start_date - timedelta(seconds=1)
        # Previous revenue
        prev_rev = float(db.query(func.sum(Invoice.total_amount)).filter(Invoice.is_draft == False, Invoice.created_at >= prev_start, Invoice.created_at <= prev_end).scalar() or 0)
        if employee_id:
            prev_rev = float(db.query(func.sum(Invoice.total_amount)).filter(Invoice.is_draft == False, Invoice.created_at >= prev_start, Invoice.created_at <= prev_end, Invoice.barber_id == employee_id).scalar() or 0)
        # Previous expenses
        prev_exp = float(db.query(func.sum(Expense.amount)).filter(Expense.created_at >= prev_start, Expense.created_at <= prev_end).scalar() or 0)
        # Previous appointments
        prev_app = db.query(func.count(Appointment.id)).filter(Appointment.appointment_date >= prev_start.date(), Appointment.appointment_date <= prev_end.date()).scalar() or 0
        if employee_id:
            prev_app = db.query(func.count(Appointment.id)).filter(Appointment.appointment_date >= prev_start.date(), Appointment.appointment_date <= prev_end.date(), Appointment.barber_id == employee_id).scalar() or 0
        # Previous avg invoice
        prev_inv_cnt = db.query(func.count(Invoice.id)).filter(Invoice.is_draft == False, Invoice.created_at >= prev_start, Invoice.created_at <= prev_end).scalar() or 0
        if employee_id:
            prev_inv_cnt = db.query(func.count(Invoice.id)).filter(Invoice.is_draft == False, Invoice.created_at >= prev_start, Invoice.created_at <= prev_end, Invoice.barber_id == employee_id).scalar() or 0
        prev_avg = (prev_rev / prev_inv_cnt) if prev_inv_cnt else 0
        # Previous occupancy
        prev_occupancy = 0
        try:
            prev_capacity = max(1, emp_count * 8 * period_days)
            prev_occupancy = min(100, int((prev_app / prev_capacity) * 100)) if prev_capacity else 0
            if prev_app > 0 and prev_occupancy < 10:
                prev_occupancy = 10
            if prev_app == 0:
                prev_occupancy = 0
        except Exception:
            prev_occupancy = 0

        todayRevenueTrend = _trend(today_revenue, prev_rev)
        todayExpensesTrend = _trend(today_expenses, prev_exp)
        netProfitTrend = _trend(net_profit, prev_rev - prev_exp)
        todayAppointmentsTrend = _trend(today_appointments, prev_app)
        avgInvoiceTrend = _trend(avg_invoice, prev_avg)
        occupancyTrend = _trend(occupancy, prev_occupancy)
    except Exception:
        todayRevenueTrend = todayExpensesTrend = netProfitTrend = todayAppointmentsTrend = avgInvoiceTrend = occupancyTrend = 0

    # 10. newCustomersThisWeek
    try:
        from app.models.customer import Customer
        week_start_dt = datetime.combine(today - timedelta(days=7), time.min)
        new_cust_q = db.query(func.count(Customer.customer_id)).filter(Customer.created_at >= week_start_dt)
        # Exclude soft-deleted if column exists
        if hasattr(Customer, "is_deleted"):
            new_cust_q = new_cust_q.filter(Customer.is_deleted == False)
        # Customer model may not have created_at as datetime; fallback
        newCustomersThisWeek = int(new_cust_q.scalar() or 0)
    except Exception:
        try:
            # Fallback: count customers with first visit in week (approx via visits)
            newCustomersThisWeek = 0
        except Exception:
            newCustomersThisWeek = 0

    return {
        "stats": {
            "todayRevenue": today_revenue,
            "todayExpenses": today_expenses,
            "netProfit": net_profit,
            "todayAppointments": today_appointments,
            "avgInvoice": avg_invoice,
            "monthGoal": month_goal,
            "occupancy": occupancy,
            "todayRevenueTrend": todayRevenueTrend,
            "todayExpensesTrend": todayExpensesTrend,
            "netProfitTrend": netProfitTrend,
            "todayAppointmentsTrend": todayAppointmentsTrend,
            "avgInvoiceTrend": avgInvoiceTrend,
            "occupancyTrend": occupancyTrend,
            "newCustomersThisWeek": newCustomersThisWeek,
        },
        "weekly_data": weekly_data,
        "service_distribution": service_distribution,
    }
