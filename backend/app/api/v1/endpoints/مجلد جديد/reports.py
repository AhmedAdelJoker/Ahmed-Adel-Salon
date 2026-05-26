from fastapi.middleware.cors import CORSMiddleware
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_owner, require_owner_or_manager
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.pos_shift import PosShift
from app.models.user import User
from app.models.walk_in_queue import WalkInQueue

from app.schemas.report import (
    BarberPerformanceRead,
    DailyReportRead,
    PaymentMethodSummaryRead,
    ProductPerformanceRead,
    ReportOverviewRead,
    ServicePerformanceRead,
    ShiftSummaryRead,
)

from sqlalchemy import func
router = APIRouter(prefix="/reports", tags=["Reports"])


def _as_float(value) -> float:
    return float(value or 0)


def _employee_display_name(employee) -> str:
    if employee is None:
        return "غير محدد"

    return (
        getattr(employee, "display_name", None)
        or getattr(employee, "displayName", None)
        or getattr(employee, "full_name", None)
        or getattr(employee, "fullName", None)
        or getattr(employee, "name", None)
        or getattr(employee, "username", None)
        or f"موظف #{getattr(employee, 'id', '-')}"
    )


def _is_barber_employee(employee) -> bool:
    return getattr(employee, "job_title", None) == "barber" or getattr(
        employee, "jobTitle", None
    ) == "barber"


def _start_of_week(target_date: date) -> date:
    return target_date - timedelta(days=target_date.weekday())


def _date_window(
    start_date: date,
    end_date: date | None = None,
) -> tuple[datetime, datetime]:
    final_date = end_date or start_date
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(final_date + timedelta(days=1), time.min)
    return start_dt, end_dt


def _load_invoices(
    db: Session,
    start_dt: datetime,
    end_dt: datetime,
) -> list[Invoice]:
    return (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.employee),
            joinedload(Invoice.items).joinedload(InvoiceItem.employee),
        )
        .filter(Invoice.created_at >= start_dt, Invoice.created_at < end_dt)
        .order_by(Invoice.created_at.desc())
        .all()
    )


def _payment_breakdown(invoices: list[Invoice]) -> list[PaymentMethodSummaryRead]:
    buckets: dict[str, dict[str, float | int]] = defaultdict(
        lambda: {"invoices_count": 0, "total_amount": 0.0}
    )

    for invoice in invoices:
        key = (invoice.payment_method or "cash").strip() or "cash"
        buckets[key]["invoices_count"] += 1
        buckets[key]["total_amount"] += _as_float(invoice.total_amount)

    return [
        PaymentMethodSummaryRead(
            payment_method=payment_method,
            invoices_count=int(values["invoices_count"]),
            total_amount=float(values["total_amount"]),
        )
        for payment_method, values in sorted(
            buckets.items(),
            key=lambda item: (-float(item[1]["total_amount"]), item[0]),
        )
    ]


def _top_services(
    invoices: list[Invoice],
    limit: int = 5,
) -> list[ServicePerformanceRead]:
    buckets: dict[tuple[int | None, str], dict[str, float | int]] = defaultdict(
        lambda: {"quantity_sold": 0, "total_revenue": 0.0}
    )

    for invoice in invoices:
        for item in invoice.items or []:
            if getattr(item, "item_type", "service") == "product":
                continue

            service_name = (item.service_name or "").strip() or "Service"
            key = (item.service_id, service_name)

            buckets[key]["quantity_sold"] += int(item.quantity or 0)
            buckets[key]["total_revenue"] += _as_float(item.total_price)

    rows = sorted(
        buckets.items(),
        key=lambda item: (
            -float(item[1]["total_revenue"]),
            -int(item[1]["quantity_sold"]),
            item[0][1],
        ),
    )[:limit]

    return [
        ServicePerformanceRead(
            service_id=service_id,
            service_name=service_name,
            quantity_sold=int(values["quantity_sold"]),
            total_revenue=float(values["total_revenue"]),
        )
        for (service_id, service_name), values in rows
    ]


def _top_products(
    invoices: list[Invoice],
    limit: int = 5,
) -> list[ProductPerformanceRead]:
    buckets: dict[tuple[int | None, str], dict[str, float | int]] = defaultdict(
        lambda: {"quantity_sold": 0, "total_revenue": 0.0}
    )

    for invoice in invoices:
        for item in invoice.items or []:
            if getattr(item, "item_type", "service") != "product":
                continue

            product_name = (item.service_name or "").strip() or "Product"
            key = (getattr(item, "product_id", None), product_name)

            buckets[key]["quantity_sold"] += int(item.quantity or 0)
            buckets[key]["total_revenue"] += _as_float(item.total_price)

    rows = sorted(
        buckets.items(),
        key=lambda item: (
            -float(item[1]["total_revenue"]),
            -int(item[1]["quantity_sold"]),
            item[0][1],
        ),
    )[:limit]

    return [
        ProductPerformanceRead(
            product_id=product_id,
            product_name=product_name,
            quantity_sold=int(values["quantity_sold"]),
            total_revenue=float(values["total_revenue"]),
        )
        for (product_id, product_name), values in rows
    ]


def _barber_performance(
    invoices: list[Invoice],
    limit: int = 5,
) -> list[BarberPerformanceRead]:
    buckets: dict[
        tuple[int | None, str],
        dict[str, float | int | set[int]],
    ] = defaultdict(
        lambda: {
            "services_count": 0,
            "invoice_ids": set(),
            "total_revenue": 0.0,
            "total_commissions": 0.0,
        }
    )

    for invoice in invoices:
        invoice_employee = getattr(invoice, "employee", None)
        invoice_employee_id = getattr(invoice, "employee_id", None)

        invoice_barber_id = (
            invoice_employee_id if _is_barber_employee(invoice_employee) else None
        )

        invoice_barber_name = (
            _employee_display_name(invoice_employee)
            if _is_barber_employee(invoice_employee)
            else "غير محدد"
        )

        if invoice.items:
            for item in invoice.items:
                if getattr(item, "item_type", "service") == "product":
                    continue

                item_employee = getattr(item, "employee", None)
                item_employee_id = getattr(item, "employee_id", None)

                barber_id = (
                    item_employee_id
                    if _is_barber_employee(item_employee)
                    else invoice_barber_id
                )

                barber_name = (
                    _employee_display_name(item_employee)
                    if _is_barber_employee(item_employee)
                    else invoice_barber_name
                )

                key = (barber_id, barber_name)

                buckets[key]["services_count"] += int(item.quantity or 0)
                buckets[key]["total_revenue"] += _as_float(item.total_price)
                buckets[key]["total_commissions"] += _as_float(
                    item.commission_amount
                )
                buckets[key]["invoice_ids"].add(invoice.id)
        else:
            key = (invoice_barber_id, invoice_barber_name)
            buckets[key]["invoice_ids"].add(invoice.id)
            buckets[key]["total_revenue"] += _as_float(invoice.total_amount)

    rows = sorted(
        buckets.items(),
        key=lambda item: (
            -float(item[1]["total_revenue"]),
            -len(item[1]["invoice_ids"]),
            item[0][1],
        ),
    )[:limit]

    return [
        BarberPerformanceRead(
            barber_id=barber_id,
            barber_name=barber_name,
            services_count=int(values["services_count"]),
            invoice_count=len(values["invoice_ids"]),
            total_revenue=float(values["total_revenue"]),
            total_commissions=float(values["total_commissions"]),
        )
        for (barber_id, barber_name), values in rows
    ]


def _sum_product_sales(invoices: list[Invoice]) -> float:
    total = 0.0

    for invoice in invoices:
        for item in invoice.items or []:
            if getattr(item, "item_type", "service") == "product":
                total += _as_float(item.total_price)

    return total


def _shift_summaries(shifts: list[PosShift]) -> list[ShiftSummaryRead]:
    rows = sorted(
        shifts,
        key=lambda shift: shift.opened_at or datetime.min,
        reverse=True,
    )

    return [
        ShiftSummaryRead(
            shift_id=shift.id,
            cashier_name=(
                (shift.cashier_user.full_name or shift.cashier_user.username)
                if shift.cashier_user is not None
                else "Cashier"
            ),
            status=shift.status,
            opening_cash=_as_float(shift.opening_cash),
            expected_cash=_as_float(shift.expected_cash),
            counted_cash=(
                None if shift.counted_cash is None else _as_float(shift.counted_cash)
            ),
            cash_difference=(
                None
                if shift.cash_difference is None
                else _as_float(shift.cash_difference)
            ),
            opened_at=shift.opened_at,
            closed_at=shift.closed_at,
        )
        for shift in rows
    ]


def _sum_invoice_total(invoices: list[Invoice]) -> float:
    return sum(_as_float(invoice.total_amount) for invoice in invoices)


def _sum_discounts(invoices: list[Invoice]) -> float:
    return sum(_as_float(invoice.discount_amount) for invoice in invoices)


@router.get("/commissions")
def get_commissions_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    barber_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    _ = current_user

    if not start_date:
        start_date = date.today()

    if not end_date:
        end_date = start_date

    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time.max)

    query = (
        db.query(InvoiceItem)
        .join(Invoice)
        .filter(
            Invoice.created_at >= start_dt,
            Invoice.created_at <= end_dt,
            InvoiceItem.item_type == "service",
            InvoiceItem.commission_amount > 0,
        )
    )

    # اسم البراميتر barber_id للتوافق مع الواجهة،
    # لكن داخليًا يتم استخدام employee_id.
    if barber_id:
        query = query.filter(InvoiceItem.employee_id == barber_id)

    items = query.options(
        joinedload(InvoiceItem.employee),
        joinedload(InvoiceItem.invoice),
    ).all()

    by_barber = defaultdict(
        lambda: {
            "barber_id": None,
            "barber_name": "غير محدد",
            "total_commission": Decimal("0.00"),
            "service_count": 0,
            "details": [],
        }
    )

    for item in items:
        employee = getattr(item, "employee", None)
        bid = getattr(item, "employee_id", None)

        barber_name = (
            _employee_display_name(employee)
            if _is_barber_employee(employee)
            else f"موظف #{bid}"
            if bid
            else "غير محدد"
        )

        if bid not in by_barber:
            by_barber[bid]["barber_id"] = bid
            by_barber[bid]["barber_name"] = barber_name

        by_barber[bid]["total_commission"] += item.commission_amount or Decimal(
            "0.00"
        )
        by_barber[bid]["service_count"] += int(item.quantity or 0)
        by_barber[bid]["details"].append(
            {
                "invoice_no": item.invoice.invoice_no if item.invoice else "-",
                "service_name": item.service_name,
                "quantity": int(item.quantity or 0),
                "unit_price": float(item.unit_price or 0),
                "total_price": float(item.total_price or 0),
                "commission_amount": float(item.commission_amount or 0),
                "created_at": item.invoice.created_at if item.invoice else None,
            }
        )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "barbers": list(by_barber.values()),
    }


@router.get("/", response_model=ReportOverviewRead)
def reports_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    _ = current_user

    today = date.today()
    week_start = _start_of_week(today)

    all_invoices = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.employee),
            joinedload(Invoice.items).joinedload(InvoiceItem.employee),
        )
        .all()
    )

    today_invoices = _load_invoices(db, *_date_window(today))
    current_week_invoices = _load_invoices(db, *_date_window(week_start, today))

    appointments = db.query(Appointment).all()
    total_revenue = _sum_invoice_total(all_invoices)
    total_expenses = db.query(func.sum(Expense.amount)).filter(Expense.status == "approved").scalar() or 0

    return ReportOverviewRead(
        total_revenue=total_revenue,
        total_expenses=float(total_expenses),
        net_income=total_revenue - float(total_expenses),
        total_invoices=len(all_invoices),
        average_invoice=(total_revenue / len(all_invoices) if all_invoices else 0),
        total_customers=db.query(Customer).count(),
        total_bookings=len(appointments),
        completed_bookings=len(
            [
                appointment
                for appointment in appointments
                if appointment.status == "completed"
            ]
        ),
        cancelled_bookings=len(
            [
                appointment
                for appointment in appointments
                if appointment.status == "cancelled"
            ]
        ),
        total_walk_ins=db.query(WalkInQueue).count(),
        total_discounts=_sum_discounts(all_invoices),
        total_product_sales=_sum_product_sales(all_invoices),
        open_shifts_count=db.query(PosShift).filter(PosShift.status == "open").count(),
        today_revenue=_sum_invoice_total(today_invoices),
        current_week_revenue=_sum_invoice_total(current_week_invoices),
        payment_methods=_payment_breakdown(all_invoices),
        top_services=_top_services(all_invoices),
        top_products=_top_products(all_invoices),
        top_barbers=_barber_performance(all_invoices),
    )


@router.get("/overview", response_model=ReportOverviewRead)
def reports_overview_alias(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    return reports_overview(db=db, current_user=current_user)


@router.get("/daily", response_model=DailyReportRead)
def daily_report(
    report_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    _ = current_user

    target_date = report_date or date.today()
    start_dt, end_dt = _date_window(target_date)

    invoices = _load_invoices(db, start_dt, end_dt)

    appointments = (
        db.query(Appointment)
        .filter(Appointment.appointment_date == target_date)
        .all()
    )

    walk_ins = (
        db.query(WalkInQueue)
        .filter(WalkInQueue.arrived_at >= start_dt, WalkInQueue.arrived_at < end_dt)
        .all()
    )

    shifts = (
        db.query(PosShift)
        .options(joinedload(PosShift.cashier_user))
        .filter(PosShift.opened_at >= start_dt, PosShift.opened_at < end_dt)
        .all()
    )

    new_customers_count = (
        db.query(Customer)
        .filter(Customer.created_at >= start_dt, Customer.created_at < end_dt)
        .count()
    )

    total_revenue = _sum_invoice_total(invoices)
    total_expenses = db.query(func.sum(Expense.amount)).filter(
        Expense.expense_date >= start_dt,
        Expense.expense_date < end_dt,
        Expense.status == "approved"
    ).scalar() or 0

    return DailyReportRead(
        date=target_date,
        total_revenue=total_revenue,
        total_expenses=float(total_expenses),
        net_income=total_revenue - float(total_expenses),
        total_invoices=len(invoices),
        average_invoice=(total_revenue / len(invoices) if invoices else 0),
        bookings_count=len(appointments),
        confirmed_bookings_count=len(
            [
                appointment
                for appointment in appointments
                if appointment.status == "confirmed"
            ]
        ),
        completed_bookings_count=len(
            [
                appointment
                for appointment in appointments
                if appointment.status == "completed"
            ]
        ),
        cancelled_bookings_count=len(
            [
                appointment
                for appointment in appointments
                if appointment.status == "cancelled"
            ]
        ),
        walk_in_customers_count=len(walk_ins),
        new_customers_count=new_customers_count,
        total_discounts=_sum_discounts(invoices),
        product_sales_amount=_sum_product_sales(invoices),
        payment_methods=_payment_breakdown(invoices),
        top_services=_top_services(invoices),
        top_products=_top_products(invoices),
        barber_performance=_barber_performance(invoices),
        shifts=_shift_summaries(shifts),
    )


@router.get("/revenue-analytics")
def get_revenue_analytics(
    period: str = Query("week", pattern="^(week|month|year)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    _ = current_user

    today = date.today()

    if period == "year":
        start_date = today.replace(month=1, day=1)
        end_date = today
        start_dt, end_dt = _date_window(start_date, end_date)

        invoices = _load_invoices(db, start_dt, end_dt)
        monthly_rev = defaultdict(float)

        for inv in invoices:
            d = inv.created_at.date() if inv.created_at else start_date
            month_key = d.strftime("%Y-%m")
            monthly_rev[month_key] += float(inv.final_amount or inv.total_amount or 0)

        chart_data = []

        for month in range(1, today.month + 1):
            month_date = date(today.year, month, 1)
            month_key = month_date.strftime("%Y-%m")
            chart_data.append(
                {
                    "name": month_date.strftime("%m/%Y"),
                    "revenue": monthly_rev[month_key],
                    "date": month_key,
                }
            )

        return {
            "period": period,
            "chart_data": chart_data,
        }

    if period == "month":
        start_date = today - timedelta(days=29)
        num_days = 30
    else:
        start_date = today - timedelta(days=6)
        num_days = 7

    end_date = today
    start_dt, end_dt = _date_window(start_date, end_date)

    invoices = _load_invoices(db, start_dt, end_dt)
    daily_rev = defaultdict(float)

    for inv in invoices:
        d = inv.created_at.date() if inv.created_at else start_date
        daily_rev[d] += float(inv.final_amount or inv.total_amount or 0)

    chart_data = []
    day_names = [
        "الإثنين",
        "الثلاثاء",
        "الأربعاء",
        "الخميس",
        "الجمعة",
        "السبت",
        "الأحد",
    ]

    for i in range(num_days):
        curr = start_date + timedelta(days=i)
        chart_data.append(
            {
                "name": curr.strftime("%m/%d")
                if period == "month"
                else day_names[curr.weekday()],
                "revenue": daily_rev[curr],
                "date": curr.isoformat(),
            }
        )

    return {
        "period": period,
        "chart_data": chart_data,
    }

@router.get("/revenue")
def get_revenue_alias(
    period: str = Query("week", pattern="^(week|month|year)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    return get_revenue_analytics(
        period=period,
        db=db,
        current_user=current_user,
    )



