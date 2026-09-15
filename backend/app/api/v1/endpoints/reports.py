from fastapi import APIRouter, Query, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.service import Service
from app.models.service_session import ServiceSession
from app.models.user import User
from app.schemas.report import (
    EmployeePerformanceItem,
    EmployeePerformanceResponse,
    EmployeePerformanceSummary,
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
    # Drafts are not sales: exclude from all revenue aggregates
    non_draft = Invoice.is_draft == False
    total_revenue = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(non_draft).scalar() or 0
    total_invoices = db.query(func.count(Invoice.id)).filter(non_draft).scalar() or 0
    done_sessions = (
        db.query(func.count(ServiceSession.id))
        .filter(ServiceSession.status.in_(["completed", "completed_unpaid", "checked_out"]))
        .scalar()
        or 0
    )

    average_invoice = float(total_revenue) / int(total_invoices) if total_invoices else 0

    # NOTE: ServiceSession has no service_id and Invoice has no session_id,
    # so top services are aggregated from sold invoice items instead.
    # Draft items are excluded via CASE so zero-rows are preserved.
    item_revenue = case((Invoice.is_draft == False, InvoiceItem.total_price), else_=0)
    item_count = case((Invoice.is_draft == False, 1), else_=0)
    top_services_rows = (
        db.query(
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            func.sum(item_count).label("sessions_count"),
            func.coalesce(func.sum(item_revenue), 0).label("total_revenue"),
        )
        .join(InvoiceItem, InvoiceItem.service_id == Service.id, isouter=True)
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id, isouter=True)
        .group_by(Service.id, Service.name)
        .order_by(func.coalesce(func.sum(item_revenue), 0).desc())
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
        .filter(Invoice.barber_id.isnot(None), non_draft)
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
        .filter(non_draft)
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


@router.get("/employee-performance", response_model=EmployeePerformanceResponse)
def employee_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager", "owner", "accountant")),
    from_date: str = Query(..., description="تاريخ البداية YYYY-MM-DD"),
    to_date: str = Query(..., description="تاريخ النهاية YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str = Query("", description="بحث بالاسم أو الخدمة"),
):
    """
    تقرير أداء الموظفين مع الترقيم (pagination).
    يعيد: قائمة الموظفين مع المبيعات، العمولة، عدد الخدمات، الفواتير، متوسط الفاتورة، وأعلى خدمة.
    """
    from datetime import datetime
    from collections import defaultdict
    from decimal import Decimal

    # Parse dates
    try:
        start_dt = datetime.strptime(from_date, "%Y-%m-%d")
        end_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD")

    # Base query: non-draft invoices in date range
    non_draft = Invoice.is_draft == False
    date_filter = Invoice.created_at.between(start_dt, end_dt)

    # Get all relevant invoices with items
    invoices_query = db.query(Invoice).filter(non_draft, date_filter)
    invoices = invoices_query.all()

    # Get all active employees for lookup
    employees = db.query(Employee).filter(Employee.status == "active").all()
    employee_map = {e.id: e for e in employees}

    # Aggregate per employee from invoice items
    emp_stats = defaultdict(lambda: {
        "employee_id": None,
        "employee_name": "",
        "job_title": None,
        "sales": Decimal("0"),
        "commission": Decimal("0"),
        "service_count": 0,
        "invoice_ids": set(),
        "top_service": defaultdict(int),
    })

    for invoice in invoices:
        orm_items = invoice.items or []
        if not orm_items:
            # Fallback: treat whole invoice as one item
            emp_id = invoice.barber_id
            if not emp_id:
                continue
            emp = employee_map.get(emp_id)
            if not emp:
                continue
            stat = emp_stats[emp_id]
            stat["employee_id"] = emp.id
            stat["employee_name"] = emp.full_name or emp.display_name or f"موظف #{emp.id}"
            stat["job_title"] = emp.job_title
            total_price = Decimal(str(invoice.total_amount or 0))
            stat["sales"] += total_price
            stat["service_count"] += 1
            stat["invoice_ids"].add(invoice.id)
            stat["top_service"]["فاتورة"] += 1
            if emp.commission_rate is not None:
                rate = Decimal(str(emp.commission_rate))
                if rate > 1:
                    rate = rate / Decimal("100")
                stat["commission"] += total_price * rate
                stat["commission_rate"] = float(rate)
            continue

        for item in orm_items:
            emp_id = invoice.barber_id
            if not emp_id:
                continue

            emp = employee_map.get(emp_id)
            if not emp:
                continue

            stat = emp_stats[emp_id]
            stat["employee_id"] = emp.id
            stat["employee_name"] = emp.full_name or emp.display_name or f"موظف #{emp.id}"
            stat["job_title"] = emp.job_title

            item_price = item.total_price or (item.unit_price or 0) * (item.quantity or 1)
            total_price = Decimal(str(item_price))
            stat["sales"] += total_price
            stat["service_count"] += 1
            stat["invoice_ids"].add(invoice.id)

            service_name = item.service_name or "خدمة"
            stat["top_service"][service_name] += 1

            rate = None
            if emp.commission_rate is not None:
                rate = Decimal(str(emp.commission_rate))
                if rate > 1:
                    rate = rate / Decimal("100")

            if rate is not None:
                stat["commission"] += total_price * rate
                stat["commission_rate"] = float(rate)

    # Convert to list and sort
    results = []
    for emp_id, stat in emp_stats.items():
        if stat["service_count"] == 0:
            continue
        top_service = max(stat["top_service"].items(), key=lambda x: x[1])[0] if stat["top_service"] else None
        avg_ticket = float(stat["sales"] / len(stat["invoice_ids"])) if stat["invoice_ids"] else 0
        results.append({
            "employee_id": emp_id,
            "employee_name": stat["employee_name"],
            "job_title": stat["job_title"],
            "sales": float(stat["sales"]),
            "commission": float(stat["commission"]),
            "service_count": stat["service_count"],
            "invoice_count": len(stat["invoice_ids"]),
            "avg_ticket": avg_ticket,
            "top_service_name": top_service,
            "commission_rate": stat.get("commission_rate"),
        })

    # Apply search filter
    if search:
        search_lower = search.lower()
        results = [r for r in results if search_lower in r["employee_name"].lower() or (r["top_service_name"] and search_lower in r["top_service_name"].lower())]

    # Sort by sales desc
    results.sort(key=lambda x: x["sales"], reverse=True)

    total = len(results)

    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    paginated = results[start:end]

    # Summary
    total_sales = sum(r["sales"] for r in results)
    total_commission = sum(r["commission"] for r in results)
    total_services = sum(r["service_count"] for r in results)
    total_invoices = sum(r["invoice_count"] for r in results)
    employee_count = len(results)
    avg_sales = total_sales / employee_count if employee_count else 0

    summary = EmployeePerformanceSummary(
        total_sales=total_sales,
        total_commission=total_commission,
        total_services=total_services,
        total_invoices=total_invoices,
        employee_count=employee_count,
        avg_sales_per_employee=avg_sales,
    )

    return EmployeePerformanceResponse(
        items=[EmployeePerformanceItem(**r) for r in paginated],
        total=total,
        page=page,
        page_size=page_size,
        summary=summary,
    )