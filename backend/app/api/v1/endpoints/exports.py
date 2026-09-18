from __future__ import annotations

import csv
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from io import BytesIO, StringIO
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    require_any_staff,
    require_cashier_manager_owner,
    require_owner,
    require_owner_or_manager,
)
from app.api.v1.endpoints.invoices import _ensure_invoice_pdf_path
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.business_settings import BusinessSettings
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.payroll_record import PayrollRecord
from app.models.product import Product
from app.models.service import Service
from app.models.user import User
from app.services.activity_service import log_activity
from app.utils.arabic_pdf import fix_arabic, ensure_pdf_font

router = APIRouter(prefix="/exports", tags=["Exports"])


def _enforce_export_permission(current_user: User):
    """Check restrictExportsToManagers setting."""
    try:
        from app.services.runtime_settings_service import get_runtime_settings
        from app.api.v1.endpoints.security_settings import DEFAULT_SECURITY_SETTINGS

        sec = get_runtime_settings("security_settings", DEFAULT_SECURITY_SETTINGS)
        if sec.get("restrictExportsToManagers", True):
            if current_user.role not in ("owner", "admin", "manager", "accountant"):
                raise HTTPException(status_code=403, detail="التصدير متاح للإدارة فقط")
    except HTTPException:
        raise
    except Exception:
        pass


EXCEL_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)
CSV_MEDIA_TYPE = "text/csv; charset=utf-8"
PDF_MEDIA_TYPE = "application/pdf"


def _safe_float(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _clean_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _parse_optional_date(value: str | None) -> date | None:
    cleaned = _optional_text(value)
    if not cleaned:
        return None
    try:
        return date.fromisoformat(cleaned)
    except ValueError:
        return None


def _parse_optional_int(value: str | int | None) -> int | None:
    if value is None:
        return None
    cleaned = _optional_text(value) if isinstance(value, str) else value
    if cleaned in (None, ""):
        return None
    try:
        return int(cleaned)
    except (TypeError, ValueError):
        return None


def _matches_term(term: str | None, *values) -> bool:
    if not term:
        return True
    lowered = term.lower()
    return any(lowered in _clean_text(value).lower() for value in values)


def _build_filename(base_name: str, extension: str, suffix: str | None = None) -> str:
    effective_suffix = suffix or date.today().isoformat()
    return f"{base_name}_{effective_suffix}.{extension}"


def _build_payroll_suffix(month: str | None, year: str | None) -> str | None:
    normalized_month = _optional_text(month)
    normalized_year = _optional_text(year)
    if normalized_year and normalized_month:
        return f"{normalized_year}-{normalized_month.zfill(2)}"
    return normalized_year or normalized_month or None


def _make_streaming_response(
    payload: BytesIO,
    *,
    media_type: str,
    filename: str,
    is_empty: bool = False,
) -> Response:
    payload.seek(0)
    content = payload.getvalue()
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Export-Empty": "1" if is_empty else "0",
    }
    return Response(content=content, media_type=media_type, headers=headers)


def _make_excel_response(
    *,
    sheet_name: str,
    columns: list[str],
    rows: list[list],
    base_name: str,
    suffix: str | None = None,
) -> StreamingResponse:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet_name[:31]
    worksheet.sheet_view.rightToLeft = True
    worksheet.freeze_panes = "A2"

    header_fill = PatternFill("solid", fgColor="0EA5E9")
    header_font = Font(bold=True, color="FFFFFF")
    right_align = Alignment(horizontal="right", vertical="center")

    worksheet.append(columns)
    for index, header in enumerate(columns, start=1):
        cell = worksheet.cell(row=1, column=index)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = right_align

    for row in rows:
        worksheet.append(row)

    for row in worksheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = right_align

    for column_cells in worksheet.columns:
        max_length = 0
        column_letter = column_cells[0].column_letter
        for cell in column_cells:
            value = "" if cell.value is None else str(cell.value)
            max_length = max(max_length, len(value))
        worksheet.column_dimensions[column_letter].width = min(max(max_length + 3, 14), 34)

    output = BytesIO()
    workbook.save(output)
    return _make_streaming_response(
        output,
        media_type=EXCEL_MEDIA_TYPE,
        filename=_build_filename(base_name, "xlsx", suffix),
        is_empty=not rows,
    )


def _make_csv_response(
    *,
    columns: list[str],
    rows: list[list],
    base_name: str,
    suffix: str | None = None,
) -> StreamingResponse:
    output = StringIO(newline="")
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(columns)
    writer.writerows(rows)
    buffer = BytesIO(output.getvalue().encode("utf-8"))
    return _make_streaming_response(
        buffer,
        media_type=CSV_MEDIA_TYPE,
        filename=_build_filename(base_name, "csv", suffix),
        is_empty=not rows,
    )


def _build_table_pdf(
    *,
    title: str,
    subtitle: str,
    columns: list[str],
    rows: list[list],
) -> BytesIO:
    font_name = ensure_pdf_font()
    output = BytesIO()
    page_width, page_height = A4
    pdf = canvas.Canvas(output, pagesize=A4)

    def draw_page_header(current_y: float) -> float:
        pdf.setFont(font_name, 16)
        pdf.drawRightString(page_width - 18 * mm, current_y, fix_arabic(title))
        current_y -= 8 * mm
        pdf.setFont(font_name, 10)
        pdf.drawRightString(page_width - 18 * mm, current_y, fix_arabic(subtitle))
        current_y -= 10 * mm
        return current_y

    y = draw_page_header(page_height - 20 * mm)
    x_positions = [190 * mm, 155 * mm, 120 * mm, 85 * mm, 45 * mm]
    header_positions = x_positions[: len(columns)]

    pdf.setFont(font_name, 10)
    for label, x_pos in zip(columns, header_positions):
        pdf.drawRightString(x_pos, y, fix_arabic(label))
    y -= 4 * mm
    pdf.line(15 * mm, y, 195 * mm, y)
    y -= 7 * mm

    if not rows:
        pdf.setFont(font_name, 11)
        pdf.drawRightString(page_width - 18 * mm, y, fix_arabic("لا توجد بيانات مطابقة للفلاتر"))
    else:
        pdf.setFont(font_name, 9)
        for row in rows:
            if y < 25 * mm:
                pdf.showPage()
                y = draw_page_header(page_height - 20 * mm)
                pdf.setFont(font_name, 10)
                for label, x_pos in zip(columns, header_positions):
                    pdf.drawRightString(x_pos, y, fix_arabic(label))
                y -= 4 * mm
                pdf.line(15 * mm, y, 195 * mm, y)
                y -= 7 * mm
                pdf.setFont(font_name, 9)

            values = ["" if value is None else str(value) for value in row]
            for value, x_pos in zip(values, header_positions):
                pdf.drawRightString(x_pos, y, fix_arabic(value[:28]))
            y -= 6 * mm

    pdf.save()
    output.seek(0)
    return output


def _build_note_pdf(*, title: str, note: str) -> BytesIO:
    return _build_table_pdf(
        title=title,
        subtitle=datetime.now().strftime("%Y-%m-%d %H:%M"),
        columns=["ملاحظة"],
        rows=[[note]],
    )


def _role_label(role: str | None) -> str:
    mapping = {
        "owner": "مالك",
        "manager": "مدير",
        "cashier": "كاشير",
        "barber": "حلاق",
    }
    return mapping.get(_clean_text(role).lower(), _clean_text(role))


def _active_label(is_active: bool | None) -> str:
    return "نشط" if bool(is_active) else "موقوف"


def _invoice_status_label(invoice: Invoice) -> str:
    if not invoice.appointment:
        return "صادرة"
    appointment_status = _clean_text(getattr(invoice.appointment, "status", ""))
    if appointment_status == "completed":
        return "مكتملة"
    if appointment_status == "confirmed":
        return "مؤكدة"
    if appointment_status == "pending":
        return "معلقة"
    if appointment_status == "cancelled":
        return "ملغية"
    return "صادرة"


def _query_employees(
    db: Session,
    *,
    search: str | None,
    q: str | None,
    status: str | None,
) -> list[User]:
    term = _optional_text(search) or _optional_text(q)
    status_filter = _optional_text(status)
    users = (
        db.query(User)
        .options(joinedload(User.employee))
        .order_by(User.id.desc())
        .all()
    )
    result = []
    for user in users:
        if not _matches_term(term, user.username, user.full_name, user.email, user.role):
            continue
        if status_filter == "active" and not user.is_active:
            continue
        if status_filter == "inactive" and user.is_active:
            continue
        result.append(user)
    return result


def _employee_rows(users: list[User]) -> list[list]:
    rows = []
    for user in users:
        emp = user.employee
        rows.append([
            user.id,
            _clean_text(user.full_name) or _clean_text(user.username),
            _role_label(user.role),
            _clean_text(getattr(emp, "phone_primary", "")),
            _clean_text(getattr(emp, "phone_secondary", "")),
            _clean_text(getattr(emp, "governorate", "")),
            _clean_text(getattr(emp, "city", "")),
            _clean_text(getattr(emp, "detailed_address", "")),
            _active_label(user.is_active),
            _safe_float(getattr(emp, "base_salary", 0)),
            _safe_float(getattr(emp, "commission_rate", 0)),
            getattr(emp, "hire_date", user.created_at).strftime("%Y-%m-%d") if getattr(emp, "hire_date", user.created_at) else "",
        ])
    return rows


def _query_customers(
    db: Session,
    *,
    search: str | None,
    q: str | None,
    start_date: date | None,
    end_date: date | None,
    status: str | None,
) -> list[list]:
    term = _optional_text(search) or _optional_text(q)
    status_filter = _optional_text(status)
    customers = db.query(Customer).order_by(Customer.customer_id.desc()).all()

    visit_stats = {
        row[0]: {"visits": row[1], "last_visit": row[2]}
        for row in (
            db.query(
                Appointment.customer_id,
                func.count(Appointment.id),
                func.max(Appointment.appointment_date),
            )
            .group_by(Appointment.customer_id)
            .all()
        )
    }
    spend_stats = {
        row[0]: _safe_float(row[1])
        for row in (
            db.query(Invoice.customer_id, func.sum(Invoice.total_amount))
            .group_by(Invoice.customer_id)
            .all()
        )
    }

    rows = []
    for customer in customers:
        if start_date and customer.created_at and customer.created_at.date() < start_date:
            continue
        if end_date and customer.created_at and customer.created_at.date() > end_date:
            continue
        if not _matches_term(
            term,
            customer.first_name,
            customer.last_name,
            customer.phone,
            customer.email,
        ):
            continue

        stats = visit_stats.get(customer.customer_id, {"visits": 0, "last_visit": None})
        visits = int(stats["visits"] or 0)
        total_spend = spend_stats.get(customer.customer_id, 0.0)
        customer_status = "نشط" if visits > 0 or total_spend > 0 else "جديد"

        if status_filter == "active" and customer_status != "نشط":
            continue
        if status_filter == "new" and customer_status != "جديد":
            continue

        rows.append([
            customer.customer_id,
            f"{customer.first_name} {customer.last_name}".strip(),
            _clean_text(customer.phone),
            visits,
            stats["last_visit"].isoformat() if stats["last_visit"] else "",
            total_spend,
            customer_status,
        ])

    return rows


def _query_invoices(
    db: Session,
    *,
    search: str | None,
    q: str | None,
    payment_method: str | None,
    status: str | None,
    start_date: date | None,
    end_date: date | None,
) -> list[Invoice]:
    term = _optional_text(search) or _optional_text(q)
    payment_filter = _optional_text(payment_method)
    status_filter = _optional_text(status)

    invoices = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.employee),
            joinedload(Invoice.appointment),
            joinedload(Invoice.created_by_user),
            joinedload(Invoice.items),
        )
        .order_by(Invoice.id.desc())
        .all()
    )

    result = []
    for invoice in invoices:
        created_date = invoice.created_at.date() if invoice.created_at else None
        if start_date and created_date and created_date < start_date:
            continue
        if end_date and created_date and created_date > end_date:
            continue
        if payment_filter and _clean_text(invoice.payment_method).lower() != payment_filter.lower():
            continue

        invoice_status = _invoice_status_label(invoice)
        if status_filter and status_filter.lower() not in invoice_status.lower():
            raw_status = _clean_text(getattr(invoice.appointment, "status", "")).lower()
            if raw_status != status_filter.lower():
                continue

        customer_name = ""
        if invoice.customer:
            customer_name = f"{invoice.customer.first_name} {invoice.customer.last_name}".strip()
        employee_name = (
            _clean_text(getattr(invoice.employee, "display_name", ""))
            or _clean_text(getattr(invoice.created_by_user, "full_name", ""))
            or _clean_text(getattr(invoice.created_by_user, "username", ""))
        )
        if not _matches_term(
            term,
            invoice.invoice_no,
            customer_name,
            employee_name,
            invoice.payment_method,
            invoice_status,
        ):
            continue
        result.append(invoice)
    return result


def _invoice_rows(invoices: list[Invoice]) -> list[list]:
    rows = []
    for invoice in invoices:
        customer_name = ""
        if invoice.customer:
            customer_name = f"{invoice.customer.first_name} {invoice.customer.last_name}".strip()
        employee_name = (
            _clean_text(getattr(invoice.employee, "display_name", ""))
            or _clean_text(getattr(invoice.created_by_user, "full_name", ""))
            or _clean_text(getattr(invoice.created_by_user, "username", ""))
        )
        total_amount = _safe_float(invoice.total_amount)
        rows.append([
            _clean_text(invoice.invoice_no),
            invoice.created_at.strftime("%Y-%m-%d %H:%M") if invoice.created_at else "",
            customer_name,
            employee_name,
            total_amount,
            _safe_float(invoice.discount_amount),
            _safe_float(invoice.total_amount),
            _clean_text(invoice.payment_method),
            _invoice_status_label(invoice),
        ])
    return rows


def _query_services(
    db: Session, *, search: str | None, q: str | None, status: str | None
) -> list[Service]:
    term = _optional_text(search) or _optional_text(q)
    status_filter = _optional_text(status)
    services = db.query(Service).order_by(Service.id.desc()).all()
    result = []
    for service in services:
        if not _matches_term(term, service.name, service.price):
            continue
        if status_filter == "active" and not service.is_active:
            continue
        if status_filter == "inactive" and service.is_active:
            continue
        result.append(service)
    return result


def _service_rows(services: list[Service]) -> list[list]:
    return [
        [
            _clean_text(service.name),
            "",
            _safe_float(service.price),
            service.duration_minutes or 0,
            _active_label(service.is_active),
        ]
        for service in services
    ]


def _query_products(
    db: Session, *, search: str | None, q: str | None, status: str | None
) -> list[Product]:
    term = _optional_text(search) or _optional_text(q)
    status_filter = _optional_text(status)
    products = db.query(Product).order_by(Product.id.desc()).all()
    result = []
    for product in products:
        if not _matches_term(term, product.name, product.sku, product.unit):
            continue
        if status_filter == "active" and not product.is_active:
            continue
        if status_filter == "inactive" and product.is_active:
            continue
        result.append(product)
    return result


def _product_rows(products: list[Product]) -> list[list]:
    return [
        [
            _clean_text(product.name),
            _clean_text(product.sku),
            _safe_float(product.quantity),
            _safe_float(product.cost_price),
            _safe_float(product.sell_price) if product.sell_price is not None else "",
            _active_label(product.is_active),
        ]
        for product in products
    ]


def _query_bookings(
    db: Session,
    *,
    search: str | None,
    q: str | None,
    status: str | None,
    start_date: date | None,
    end_date: date | None,
) -> list[Appointment]:
    term = _optional_text(search) or _optional_text(q)
    status_filter = _optional_text(status)
    bookings = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.customer),
            joinedload(Appointment.employee),
            joinedload(Appointment.services),
        )
        .order_by(Appointment.id.desc())
        .all()
    )
    result = []
    for booking in bookings:
        if start_date and booking.appointment_date < start_date:
            continue
        if end_date and booking.appointment_date > end_date:
            continue
        if status_filter and _clean_text(booking.status).lower() != status_filter.lower():
            continue
        customer_name = (
            f"{booking.customer.first_name} {booking.customer.last_name}".strip()
            if booking.customer
            else ""
        )
        employee_name = _clean_text(getattr(booking.employee, "display_name", ""))
        if not _matches_term(
            term, customer_name, employee_name, booking.status, booking.notes
        ):
            continue
        result.append(booking)
    return result


def _booking_rows(bookings: list[Appointment]) -> list[list]:
    rows = []
    for booking in bookings:
        customer_name = (
            f"{booking.customer.first_name} {booking.customer.last_name}".strip()
            if booking.customer
            else ""
        )
        employee_name = _clean_text(getattr(booking.employee, "display_name", ""))
        services = ", ".join(
            _clean_text(item.service_name_snapshot) for item in (booking.services or [])
        )
        rows.append([
            booking.id,
            customer_name,
            employee_name,
            booking.appointment_date.isoformat() if booking.appointment_date else "",
            booking.appointment_time.strftime("%H:%M") if booking.appointment_time else "",
            _clean_text(booking.status),
            services,
            _safe_float(booking.total_estimated_price),
            _clean_text(booking.notes),
        ])
    return rows


def _query_expenses(
    db: Session,
    *,
    search: str | None,
    q: str | None,
    category: str | None,
    payment_method: str | None,
    status: str | None,
    start_date: date | None,
    end_date: date | None,
) -> list[Expense]:
    term = _optional_text(search) or _optional_text(q)
    category_filter = _optional_text(category)
    payment_filter = _optional_text(payment_method)
    status_filter = _optional_text(status)

    query = db.query(Expense).order_by(Expense.expense_date.desc())
    if start_date:
        query = query.filter(Expense.expense_date >= start_date)
    if end_date:
        query = query.filter(Expense.expense_date <= end_date)
    if category_filter:
        query = query.filter(Expense.category == category_filter)
    if payment_filter:
        query = query.filter(Expense.payment_method == payment_filter)
    if status_filter:
        query = query.filter(Expense.status == status_filter)

    expenses = query.all()
    if not term:
        return expenses

    result = []
    for exp in expenses:
        if _matches_term(term, exp.title, exp.description, exp.category, exp.amount):
            result.append(exp)
    return result


def _expense_rows(expenses: list[Expense]) -> list[list]:
    return [
        [
            exp.expense_date.strftime("%Y-%m-%d %H:%M") if exp.expense_date else "",
            _clean_text(exp.title),
            _clean_text(exp.category),
            _safe_float(exp.amount),
            _clean_text(exp.payment_method),
            _clean_text(exp.status),
            "",  # created_by placeholder
            _clean_text(exp.description),
        ]
        for exp in expenses
    ]


def _query_payroll(
    db: Session,
    *,
    month: int | None,
    year: int | None,
    status: str | None,
    employee_id: int | None,
) -> list[PayrollRecord]:
    query = db.query(PayrollRecord).order_by(PayrollRecord.id.desc())
    if month:
        query = query.filter(PayrollRecord.period_month == month)
    if year:
        query = query.filter(PayrollRecord.period_year == year)
    if status:
        query = query.filter(PayrollRecord.status == status)
    if employee_id:
        query = query.filter(PayrollRecord.employee_id == employee_id)

    return query.all()


def _payroll_rows(records: list[PayrollRecord]) -> list[list]:
    return [
        [
            record.employee_name_snapshot,
            record.period_month,
            record.period_year,
            _safe_float(record.base_salary),
            _safe_float(record.commission_amount),
            _safe_float(record.bonus_amount),
            _safe_float(record.deduction_amount),
            _safe_float(record.advance_amount),
            _safe_float(record.net_salary),
            _clean_text(record.status),
            record.payment_date.strftime("%Y-%m-%d") if record.payment_date else "",
        ]
        for record in records
    ]


def _revenue_date_window(
period: str | None, start_date: date | None, end_date: date | None):
    today = date.today()
    normalized_period = _clean_text(period).lower()
    if start_date or end_date:
        return start_date, end_date, normalized_period or "custom"
    if normalized_period in {"daily", "day"}:
        return today, today, "daily"
    if normalized_period in {"weekly", "week"}:
        return today - timedelta(days=6), today, "week"
    if normalized_period in {"monthly", "month"}:
        return today.replace(day=1), today, "month"
    return None, None, normalized_period or "all"


def _revenue_rows(
    db: Session,
    *,
    period: str | None,
    start_date: date | None,
    end_date: date | None,
) -> tuple[list[list], str]:
    effective_start, effective_end, period_label = _revenue_date_window(
        period,
        start_date,
        end_date,
    )
    
    # 1. Fetch Invoices
    inv_query = db.query(Invoice).options(joinedload(Invoice.appointment))
    if effective_start:
        inv_query = inv_query.filter(Invoice.created_at >= datetime.combine(effective_start, datetime.min.time()))
    if effective_end:
        inv_query = inv_query.filter(Invoice.created_at <= datetime.combine(effective_end, datetime.max.time()))
    
    invoices = inv_query.order_by(Invoice.created_at.asc()).all()

    # 2. Fetch Expenses
    exp_query = db.query(Expense)
    if effective_start:
        exp_query = exp_query.filter(Expense.expense_date >= datetime.combine(effective_start, datetime.min.time()))
    if effective_end:
        exp_query = exp_query.filter(Expense.expense_date <= datetime.combine(effective_end, datetime.max.time()))
    
    expenses_list = exp_query.all()

    grouped = defaultdict(lambda: {"revenue": 0.0, "expenses": 0.0, "invoice_count": 0})
    
    for invoice in invoices:
        invoice_date = invoice.created_at.date() if invoice.created_at else None
        if not invoice_date:
            continue
        grouped[invoice_date]["revenue"] += _safe_float(invoice.total_amount)
        grouped[invoice_date]["invoice_count"] += 1
        
    for exp in expenses_list:
        exp_date = exp.expense_date.date() if exp.expense_date else exp.created_at.date()
        if not exp_date:
            continue
        grouped[exp_date]["expenses"] += _safe_float(exp.amount)

    rows = []
    for current_date in sorted(grouped.keys()):
        revenue = grouped[current_date]["revenue"]
        expenses = grouped[current_date]["expenses"]
        rows.append([
            current_date.isoformat(),
            revenue,
            expenses,
            revenue - expenses,
            grouped[current_date]["invoice_count"],
        ])
    return rows, period_label


def _report_suffix(start_date: date | None, end_date: date | None, period_label: str) -> str:
    if start_date and end_date:
        if start_date == end_date:
            return start_date.isoformat()
        return f"{start_date.isoformat()}_{end_date.isoformat()}"
    if start_date:
        return start_date.isoformat()
    return f"{period_label}_{date.today().isoformat()}"


EMPLOYEE_COLUMNS = [
    "كود الموظف",
    "الاسم",
    "الوظيفة",
    "الهاتف الأساسي",
    "الهاتف الإضافي",
    "المحافظة",
    "المدينة",
    "العنوان",
    "الحالة",
    "المرتب الأساسي",
    "نسبة العمولة",
    "تاريخ التعيين",
]
CUSTOMER_COLUMNS = [
    "كود العميل",
    "الاسم",
    "الهاتف",
    "عدد الزيارات",
    "آخر زيارة",
    "إجمالي الإنفاق",
    "الحالة",
]
INVOICE_COLUMNS = [
    "رقم الفاتورة",
    "التاريخ",
    "العميل",
    "الموظف / الحلاق",
    "الإجمالي",
    "الخصم",
    "النهائي",
    "طريقة الدفع",
    "الحالة",
]
EXPENSE_COLUMNS = [
    "التاريخ",
    "العنوان",
    "التصنيف",
    "المبلغ",
    "طريقة الدفع",
    "الحالة",
    "المسجل بواسطة",
    "ملاحظات",
]
PAYROLL_COLUMNS = [
    "الموظف",
    "الشهر",
    "السنة",
    "الراتب الأساسي",
    "العمولة",
    "المكافآت",
    "الخصومات",
    "السلف",
    "الصافي",
    "الحالة",
    "تاريخ الصرف",
]
SERVICE_COLUMNS = [
    "اسم الخدمة",
    "التصنيف",
    "السعر",
    "المدة",
    "الحالة",
]
PRODUCT_COLUMNS = [
    "اسم المنتج",
    "الباركود",
    "الكمية",
    "سعر الشراء",
    "سعر البيع",
    "الحالة",
]
REVENUE_COLUMNS = [
    "التاريخ",
    "الإيرادات",
    "المصروفات",
    "صافي الربح",
    "عدد الفواتير",
]
BOOKING_COLUMNS = [
    "رقم الحجز",
    "العميل",
    "الحلاق",
    "التاريخ",
    "الوقت",
    "الحالة",
    "الخدمات",
    "الإجمالي",
    "ملاحظات",
]


@router.get("/employees/excel")
def export_employees_excel(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    rows = _employee_rows(_query_employees(db, search=search, q=q, status=status))
    log_activity(db, user_id=current_user.id, action="export", entity_type="employee", description="تصدير قائمة الموظفين (Excel)")
    return _make_excel_response(
        sheet_name="Employees",
        columns=EMPLOYEE_COLUMNS,
        rows=rows,
        base_name="employees",
    )


@router.get("/employees/csv")
def export_employees_csv(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    rows = _employee_rows(_query_employees(db, search=search, q=q, status=status))
    log_activity(db, user_id=current_user.id, action="export", entity_type="employee", description="تصدير قائمة الموظفين (CSV)")
    return _make_csv_response(columns=EMPLOYEE_COLUMNS, rows=rows, base_name="employees")


@router.get("/customers/excel")
def export_customers_excel(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    _enforce_export_permission(current_user)
    rows = _query_customers(
        db,
        search=search,
        q=q,
        start_date=_parse_optional_date(start_date),
        end_date=_parse_optional_date(end_date),
        status=status,
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="customer", description="تصدير قائمة العملاء (Excel)")
    return _make_excel_response(
        sheet_name="Customers",
        columns=CUSTOMER_COLUMNS,
        rows=rows,
        base_name="customers",
    )


@router.get("/customers/csv")
def export_customers_csv(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    _enforce_export_permission(current_user)
    rows = _query_customers(
        db,
        search=search,
        q=q,
        start_date=_parse_optional_date(start_date),
        end_date=_parse_optional_date(end_date),
        status=status,
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="customer", description="تصدير قائمة العملاء (CSV)")
    return _make_csv_response(columns=CUSTOMER_COLUMNS, rows=rows, base_name="customers")


@router.get("/bookings/excel")
def export_bookings_excel(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    _enforce_export_permission(current_user)
    rows = _booking_rows(
        _query_bookings(
            db,
            search=search,
            q=q,
            status=status,
            start_date=_parse_optional_date(start_date),
            end_date=_parse_optional_date(end_date),
        )
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="appointment", description="تصدير قائمة الحجوزات (Excel)")
    return _make_excel_response(
        sheet_name="Bookings",
        columns=BOOKING_COLUMNS,
        rows=rows,
        base_name="bookings",
    )


@router.get("/bookings/csv")
def export_bookings_csv(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    _enforce_export_permission(current_user)
    rows = _booking_rows(
        _query_bookings(
            db,
            search=search,
            q=q,
            status=status,
            start_date=_parse_optional_date(start_date),
            end_date=_parse_optional_date(end_date),
        )
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="appointment", description="تصدير قائمة الحجوزات (CSV)")
    return _make_csv_response(columns=BOOKING_COLUMNS, rows=rows, base_name="bookings")


@router.get("/invoices/excel")
def export_invoices_excel(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    rows = _invoice_rows(
        _query_invoices(
            db,
            search=search,
            q=q,
            payment_method=payment_method,
            status=status,
            start_date=_parse_optional_date(start_date),
            end_date=_parse_optional_date(end_date),
        )
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="invoice", description="تصدير قائمة الفواتير (Excel)")
    return _make_excel_response(
        sheet_name="Invoices",
        columns=INVOICE_COLUMNS,
        rows=rows,
        base_name="invoices",
    )


@router.get("/invoices/csv")
def export_invoices_csv(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    rows = _invoice_rows(
        _query_invoices(
            db,
            search=search,
            q=q,
            payment_method=payment_method,
            status=status,
            start_date=_parse_optional_date(start_date),
            end_date=_parse_optional_date(end_date),
        )
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="invoice", description="تصدير قائمة الفواتير (CSV)")
    return _make_csv_response(columns=INVOICE_COLUMNS, rows=rows, base_name="invoices")


@router.get("/expenses/excel")
def export_expenses_excel(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    rows = _expense_rows(
        _query_expenses(
            db,
            search=search,
            q=q,
            category=category,
            payment_method=payment_method,
            status=status,
            start_date=_parse_optional_date(start_date),
            end_date=_parse_optional_date(end_date),
        )
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="expense", description="تصدير قائمة المصروفات (Excel)")
    return _make_excel_response(
        sheet_name="Expenses",
        columns=EXPENSE_COLUMNS,
        rows=rows,
        base_name="expenses",
    )


@router.get("/expenses/csv")
def export_expenses_csv(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    rows = _expense_rows(
        _query_expenses(
            db,
            search=search,
            q=q,
            category=category,
            payment_method=payment_method,
            status=status,
            start_date=_parse_optional_date(start_date),
            end_date=_parse_optional_date(end_date),
        )
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="expense", description="تصدير قائمة المصروفات (CSV)")
    return _make_csv_response(columns=EXPENSE_COLUMNS, rows=rows, base_name="expenses")


@router.get("/expenses/archive/excel")
def export_expenses_archive_excel(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: str | None = Query(default=None),
    limit: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    rows = _expense_rows(
        _query_expenses(
            db,
            search=search,
            q=q,
            category=category,
            payment_method=payment_method,
            status=status,
            start_date=_parse_optional_date(start_date),
            end_date=_parse_optional_date(end_date),
        )
    )
    return _make_excel_response(
        sheet_name="ExpensesArchive",
        columns=EXPENSE_COLUMNS,
        rows=rows,
        base_name="expenses_archive",
    )


@router.get("/payroll/excel")
def export_payroll_excel(
    month: str | None = Query(default=None),
    year: str | None = Query(default=None),
    status: str | None = Query(default=None),
    employee_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    suffix = _build_payroll_suffix(month, year)
    rows = _payroll_rows(
        _query_payroll(
            db,
            month=_parse_optional_int(month),
            year=_parse_optional_int(year),
            status=status,
            employee_id=_parse_optional_int(employee_id),
        )
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="payroll", description="تصدير كشف الرواتب")
    return _make_excel_response(
        sheet_name="Payroll",
        columns=PAYROLL_COLUMNS,
        rows=rows,
        base_name="payroll",
        suffix=suffix,
    )


@router.get("/payroll/csv")
def export_payroll_csv(
    month: str | None = Query(default=None),
    year: str | None = Query(default=None),
    status: str | None = Query(default=None),
    employee_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    suffix = _build_payroll_suffix(month, year)
    rows = _payroll_rows(
        _query_payroll(
            db,
            month=_parse_optional_int(month),
            year=_parse_optional_int(year),
            status=status,
            employee_id=_parse_optional_int(employee_id),
        )
    )
    return _make_csv_response(
        columns=PAYROLL_COLUMNS,
        rows=rows,
        base_name="payroll",
        suffix=suffix,
    )


@router.get("/payroll/archive/excel")
def export_payroll_archive_excel(
    month: str | None = Query(default=None),
    year: str | None = Query(default=None),
    status: str | None = Query(default=None),
    employee_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    suffix = _build_payroll_suffix(month, year)
    rows = _payroll_rows(
        _query_payroll(
            db,
            month=_parse_optional_int(month),
            year=_parse_optional_int(year),
            status=status,
            employee_id=_parse_optional_int(employee_id),
        )
    )
    log_activity(db, user_id=current_user.id, action="export", entity_type="payroll", description="تصدير كشف الرواتب")
    return _make_excel_response(
        sheet_name="PayrollArchive",
        columns=PAYROLL_COLUMNS,
        rows=rows,
        base_name="payroll_archive",
        suffix=suffix,
    )


@router.get("/services/excel")
def export_services_excel(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    rows = _service_rows(_query_services(db, search=search, q=q, status=status))
    log_activity(db, user_id=current_user.id, action="export", entity_type="service", description="تصدير قائمة الخدمات (Excel)")
    return _make_excel_response(
        sheet_name="Services",
        columns=SERVICE_COLUMNS,
        rows=rows,
        base_name="services",
    )


@router.get("/products/excel")
def export_products_excel(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    rows = _product_rows(_query_products(db, search=search, q=q, status=status))
    log_activity(db, user_id=current_user.id, action="export", entity_type="product", description="تصدير قائمة المنتجات (Excel)")
    return _make_excel_response(
        sheet_name="Products",
        columns=PRODUCT_COLUMNS,
        rows=rows,
        base_name="products",
    )


@router.get("/products/csv")
def export_products_csv(
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    rows = _product_rows(_query_products(db, search=search, q=q, status=status))
    log_activity(db, user_id=current_user.id, action="export", entity_type="product", description="تصدير قائمة المنتجات (CSV)")
    return _make_csv_response(columns=PRODUCT_COLUMNS, rows=rows, base_name="products")


@router.get("/reports/revenue/excel")
def export_revenue_report_excel(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    period: str | None = Query(default="week"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    rows, period_label = _revenue_rows(
        db,
        period=period,
        start_date=_parse_optional_date(start_date),
        end_date=_parse_optional_date(end_date),
    )
    suffix = _report_suffix(
        _parse_optional_date(start_date),
        _parse_optional_date(end_date),
        period_label,
    )
    return _make_excel_response(
        sheet_name="RevenueReport",
        columns=REVENUE_COLUMNS,
        rows=rows,
        base_name=f"financial_report_{period_label}",
        suffix=suffix,
    )


@router.get("/reports/revenue/pdf")
def export_revenue_report_pdf(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    period: str | None = Query(default="week"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    parsed_start = _parse_optional_date(start_date)
    parsed_end = _parse_optional_date(end_date)
    rows, period_label = _revenue_rows(
        db,
        period=period,
        start_date=parsed_start,
        end_date=parsed_end,
    )
    suffix = _report_suffix(parsed_start, parsed_end, period_label)
    pdf_buffer = _build_table_pdf(
        title="تقرير الإيرادات",
        subtitle=f"Revenue Report - {suffix}",
        columns=REVENUE_COLUMNS,
        rows=rows,
    )
    return _make_streaming_response(
        pdf_buffer,
        media_type=PDF_MEDIA_TYPE,
        filename=_build_filename(f"financial_report_{period_label}", "pdf", suffix),
        is_empty=not rows,
    )


@router.get("/reports/daily/pdf")
def export_daily_report_pdf(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    parsed_start = _parse_optional_date(start_date) or date.today()
    parsed_end = _parse_optional_date(end_date) or parsed_start
    rows, _ = _revenue_rows(
        db,
        period="daily",
        start_date=parsed_start,
        end_date=parsed_end,
    )
    suffix = _report_suffix(parsed_start, parsed_end, "daily")
    pdf_buffer = _build_table_pdf(
        title="التقرير اليومي",
        subtitle=f"Daily Report - {suffix}",
        columns=REVENUE_COLUMNS,
        rows=rows,
    )
    return _make_streaming_response(
        pdf_buffer,
        media_type=PDF_MEDIA_TYPE,
        filename=_build_filename("daily_report", "pdf", suffix),
        is_empty=not rows,
    )


@router.get("/reports/strategic-growth/pdf")
def export_strategic_growth_report_pdf(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    parsed_start = _parse_optional_date(start_date) or (date.today() - timedelta(days=30))
    parsed_end = _parse_optional_date(end_date) or date.today()
    
    settings = db.query(BusinessSettings).first()
    salon_name = settings.salon_name if settings else "SalonPro"
    
    # 1. Financial Stats
    invoices = db.query(Invoice).options(joinedload(Invoice.appointment)).filter(
        Invoice.created_at >= datetime.combine(parsed_start, datetime.min.time()),
        Invoice.created_at <= datetime.combine(parsed_end, datetime.max.time())
    ).all()
    
    # Filter out cancelled in Python
    invoices = [inv for inv in invoices if _invoice_status_label(inv) != "ملغية"]
    
    total_revenue = sum(_safe_float(inv.total_amount) for inv in invoices)
    total_discount = sum(_safe_float(inv.discount_amount) for inv in invoices)
    invoice_count = len(invoices)
    avg_ticket = total_revenue / invoice_count if invoice_count > 0 else 0.0
    
    # 2. Top Services
    top_services = db.query(
        InvoiceItem.service_name,
        func.count(InvoiceItem.id).label('count'),
        func.coalesce(func.sum(InvoiceItem.total_price), 0).label('revenue')
    ).join(Invoice).outerjoin(Appointment).filter(
        Invoice.created_at >= datetime.combine(parsed_start, datetime.min.time()),
        Invoice.created_at <= datetime.combine(parsed_end, datetime.max.time()),
        or_(Appointment.status != "cancelled", Appointment.id.is_(None)),
        InvoiceItem.service_id.isnot(None)
    ).group_by(InvoiceItem.service_name).order_by(func.count(InvoiceItem.id).desc()).limit(5).all()
    
    # 3. Team Performance
    team_perf = db.query(
        Employee.full_name,
        func.count(Invoice.id).label('count'),
        func.coalesce(func.sum(Invoice.total_amount), 0).label('revenue')
    ).join(Invoice, Invoice.barber_id == Employee.id).outerjoin(Appointment, Invoice.appointment_id == Appointment.id).filter(
        Invoice.created_at >= datetime.combine(parsed_start, datetime.min.time()),
        Invoice.created_at <= datetime.combine(parsed_end, datetime.max.time()),
        or_(Appointment.status != "cancelled", Appointment.id.is_(None))
    ).group_by(Employee.id, Employee.full_name).order_by(func.sum(Invoice.total_amount).desc()).all()

    # Build PDF
    font_name = ensure_pdf_font()
    output = BytesIO()
    page_width, page_height = A4
    pdf = canvas.Canvas(output, pagesize=A4)
    
    def draw_header():
        pdf.setFillColorRGB(0.05, 0.05, 0.2) # Deep indigo
        pdf.rect(0, page_height - 40*mm, page_width, 40*mm, fill=1, stroke=0)
        pdf.setFillColorRGB(1, 1, 1)
        pdf.setFont(font_name, 22)
        pdf.drawRightString(page_width - 20*mm, page_height - 20*mm, fix_arabic(f"تقرير النمو الاستراتيجي - {salon_name}"))
        pdf.setFont(font_name, 10)
        pdf.drawRightString(page_width - 20*mm, page_height - 30*mm, fix_arabic(f"الفترة: {parsed_start} إلى {parsed_end}"))
    
    draw_header()
    y = page_height - 55*mm
    
    # Section 1: KPIs
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont(font_name, 16)
    pdf.drawRightString(page_width - 20*mm, y, fix_arabic("ملخص الأداء المالي"))
    y -= 10*mm
    
    pdf.setFont(font_name, 12)
    stats = [
        (f"إجمالي الإيرادات: {_safe_float(total_revenue):,.2f} ج.م", f"عدد الفواتير: {invoice_count}"),
        (f"متوسط قيمة الفاتورة: {_safe_float(avg_ticket):,.2f} ج.م", f"إجمالي الخصومات: {_safe_float(total_discount):,.2f} ج.م")
    ]
    for left, right in stats:
        pdf.drawRightString(page_width - 25*mm, y, fix_arabic(left))
        pdf.drawRightString(page_width - 110*mm, y, fix_arabic(right))
        y -= 8*mm
        
    y -= 10*mm
    pdf.line(20*mm, y, page_width - 20*mm, y)
    y -= 10*mm
    
    # Section 2: Services
    pdf.setFont(font_name, 16)
    pdf.drawRightString(page_width - 20*mm, y, fix_arabic("الخدمات الأكثر طلباً"))
    y -= 10*mm
    pdf.setFont(font_name, 11)
    for s in top_services:
        text = f"{s.service_name or 'N/A'}: {s.count} عملية (صافي: {_safe_float(s.revenue):,.2f} ج.م)"
        pdf.drawRightString(page_width - 25*mm, y, fix_arabic(text))
        y -= 7*mm
        
    y -= 10*mm
    pdf.setFont(font_name, 16)
    pdf.drawRightString(page_width - 20*mm, y, fix_arabic("أداء فريق العمل"))
    y -= 10*mm
    pdf.setFont(font_name, 11)
    for p in team_perf:
        text = f"{p.full_name or 'N/A'}: {p.count} عملية (إجمالي مبيعات: {_safe_float(p.revenue):,.2f} ج.م)"
        pdf.drawRightString(page_width - 25*mm, y, fix_arabic(text))
        y -= 7*mm

    pdf.setFont(font_name, 8)
    pdf.drawCentredString(page_width/2, 15*mm, fix_arabic("تم توليد هذا التقرير التنفيذي بواسطة نظام الذكاء الاصطناعي للإدارة"))
    
    pdf.save()
    output.seek(0)
    return _make_streaming_response(
        output,
        media_type=PDF_MEDIA_TYPE,
        filename=_build_filename("strategic_growth_audit", "pdf"),
    )


@router.get("/invoices/{invoice_id}/pdf")
def export_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.employee),
            joinedload(Invoice.items),
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    
    pdf_path = _ensure_invoice_pdf_path(db, invoice)
    if not pdf_path or not pdf_path.exists():
        raise HTTPException(status_code=404, detail="فشل في إنشاء أو العثور على ملف PDF")
    
    def iterfile():
        with open(pdf_path, mode="rb") as f:
            yield from f

    filename = f"invoice_{invoice.invoice_no}.pdf"
    return StreamingResponse(
        iterfile(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Export-Empty": "0",
        },
    )


def _build_payslip_pdf(record: PayrollRecord) -> BytesIO:
    font_name = _ensure_pdf_font()
    output = BytesIO()
    page_width, page_height = A4
    pdf = canvas.Canvas(output, pagesize=A4)

    def draw_header():
        pdf.setFont(font_name, 18)
        pdf.drawRightString(page_width - 20 * mm, page_height - 25 * mm, "كشف مفردات المرتب (Payslip)")
        pdf.setFont(font_name, 10)
        pdf.drawRightString(page_width - 20 * mm, page_height - 32 * mm, f"تاريخ الإصدار: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        pdf.line(15 * mm, page_height - 35 * mm, page_width - 15 * mm, page_height - 35 * mm)

    draw_header()
    y = page_height - 45 * mm

    # Employee Info Box
    pdf.setFont(font_name, 12)
    pdf.drawRightString(page_width - 20 * mm, y, f"اسم الموظف: {record.employee_name_snapshot}")
    pdf.drawRightString(100 * mm, y, f"الفترة: {record.period_month} / {record.period_year}")
    y -= 8 * mm
    pdf.drawRightString(page_width - 20 * mm, y, f"الوظيفة: {record.role_snapshot or 'Staff'}")
    pdf.drawRightString(100 * mm, y, f"حالة الصرف: {'تم الصرف' if record.status == 'paid' else 'قيد الانتظار'}")
    
    y -= 15 * mm
    pdf.line(15 * mm, y, page_width - 15 * mm, y)
    y -= 10 * mm

    # Earnings vs Deductions Table
    pdf.setFont(font_name, 14)
    pdf.drawRightString(page_width - 20 * mm, y, "الاستحقاقات (+)")
    pdf.drawRightString(page_width - 110 * mm, y, "الاستقطاعات (-)")
    y -= 8 * mm
    pdf.setFont(font_name, 11)
    
    start_y = y
    # Earnings
    earnings = [
        ("الراتب الأساسي", record.base_salary),
        ("العمولات", record.commission_amount),
        ("المكافآت والحوافز", record.bonus_amount),
    ]
    for label, amount in earnings:
        pdf.drawRightString(page_width - 25 * mm, y, label)
        pdf.drawString(110 * mm, y, f"{float(amount or 0):,.2f}")
        y -= 7 * mm
    
    y = start_y
    # Deductions
    deductions = [
        ("الخصومات الإدارية", record.deduction_amount),
        ("السلف والمسحوبات", record.advance_amount),
    ]
    for label, amount in deductions:
        pdf.drawRightString(page_width - 115 * mm, y, label)
        pdf.drawString(20 * mm, y, f"{float(amount or 0):,.2f}")
        y -= 7 * mm

    y = min(y, start_y - 30 * mm)
    y -= 10 * mm
    pdf.line(15 * mm, y, page_width - 15 * mm, y)
    y -= 10 * mm
    
    # Net Salary
    pdf.setFont(font_name, 16)
    pdf.drawRightString(page_width - 20 * mm, y, "إجمالي صافي المستحقات:")
    pdf.drawString(20 * mm, y, f"{float(record.net_salary or 0):,.2f} ج.م")
    
    y -= 20 * mm
    pdf.setFont(font_name, 10)
    if record.notes:
        pdf.drawRightString(page_width - 20 * mm, y, f"ملاحظات: {record.notes}")
        y -= 10 * mm

    pdf.setFont(font_name, 9)
    pdf.drawCentredString(page_width / 2, 20 * mm, "تم إنشاء هذا المستند آلياً بواسطة نظام إدارة الصالون")

    pdf.save()
    output.seek(0)
    return output


@router.get("/payroll/{payroll_id}/pdf")
def export_payroll_pdf(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="سجل الراتب غير موجود")
    
    pdf_buffer = _build_payslip_pdf(record)
    
    return _make_streaming_response(
        pdf_buffer,
        media_type=PDF_MEDIA_TYPE,
        filename=_build_filename(f"payslip_{record.employee_name_snapshot}", "pdf", f"{record.period_year}_{record.period_month}"),
    )



