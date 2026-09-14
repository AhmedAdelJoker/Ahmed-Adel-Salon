"""Periodic financial report delivery (APScheduler-driven).

Computes a revenue/expense/net summary for the schedule's period and delivers
it as an in-app notification and/or a WhatsApp message.
"""
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from app.models.business_settings import BusinessSettings
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.notification import Notification
from app.models.report_schedule import ReportSchedule
from app.models.user import User
from app.utils.media import get_upload_path

FREQUENCY_LABELS = {"daily": "اليومي", "weekly": "الأسبوعي", "monthly": "الشهري"}
KEEP_PDFS = int(__import__("os").environ.get("SCHEDULED_PDF_KEEP", "20"))


def period_for_frequency(frequency: str, now: Optional[datetime] = None) -> tuple[datetime, datetime, str]:
    """Resolve (start, end, arabic_label) for a schedule frequency."""
    now = now or datetime.utcnow()
    if frequency == "weekly":
        start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        label = "آخر 7 أيام"
    elif frequency == "monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        label = "الشهر الحالي حتى الآن"
    else:  # daily -> yesterday (full day)
        day = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        start = day
        label = f"يوم {day.date().isoformat()}"
    return start, now, label


def compute_next_run(frequency: str, from_dt: Optional[datetime] = None) -> datetime:
    from_dt = from_dt or datetime.utcnow()
    if frequency == "weekly":
        return from_dt + timedelta(days=7)
    if frequency == "monthly":
        return from_dt + timedelta(days=30)
    return from_dt + timedelta(days=1)


def compute_period_summary(db: Session, start: datetime, end: datetime) -> dict[str, Any]:
    revenue = (
        db.query(func.coalesce(func.sum(Invoice.total_amount), 0))
        .filter(
            Invoice.is_draft.is_(False),
            Invoice.created_at >= start,
            Invoice.created_at <= end,
        )
        .scalar()
    )
    invoice_count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.is_draft.is_(False),
            Invoice.created_at >= start,
            Invoice.created_at <= end,
        )
        .scalar()
    )
    expense_filter = and_(
        Expense.status != "rejected",
        or_(
            and_(Expense.expense_date.isnot(None), Expense.expense_date >= start, Expense.expense_date <= end),
            and_(Expense.expense_date.is_(None), Expense.created_at >= start, Expense.created_at <= end),
        ),
    )
    expenses = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(expense_filter).scalar()
    expense_count = db.query(func.count(Expense.id)).filter(expense_filter).scalar()
    revenue_f = float(revenue or 0)
    expenses_f = float(expenses or 0)
    return {
        "revenue": revenue_f,
        "expenses": expenses_f,
        "net": revenue_f - expenses_f,
        "invoice_count": int(invoice_count or 0),
        "expense_count": int(expense_count or 0),
    }


def _fmt_egp(value: float) -> str:
    return f"{value:,.0f} ج.م"


def generate_summary_pdf(
    name: str,
    frequency: str,
    period_label: str,
    summary: dict[str, Any],
    now: Optional[datetime] = None,
) -> tuple[str, str]:
    """Build an Arabic summary PDF, store it under uploads, return (file_path, public_url)."""
    from app.api.v1.endpoints.exports import _build_table_pdf
    from app.utils.media import get_upload_path

    now = now or datetime.utcnow()
    freq = FREQUENCY_LABELS.get(frequency, frequency)
    pdf_buffer = _build_table_pdf(
        title=f"{name} ({freq})",
        subtitle=f"{period_label} — تم التوليد {now.strftime('%Y-%m-%d %H:%M')}",
        columns=["البيان", "القيمة"],
        rows=[
            ["الإيرادات", _fmt_egp(summary["revenue"])],
            ["عدد الفواتير", str(summary["invoice_count"])],
            ["المصروفات", _fmt_egp(summary["expenses"])],
            ["عدد بنود المصروفات", str(summary["expense_count"])],
            ["الصافي", _fmt_egp(summary["net"])],
        ],
    )
    out_dir = get_upload_path("scheduled_reports")
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"financial_report_{frequency}_{now.strftime('%Y%m%d_%H%M%S')}.pdf"
    file_path = out_dir / filename
    with open(file_path, "wb") as fh:
        fh.write(pdf_buffer.getvalue())
    return str(file_path), f"/uploads/scheduled_reports/{filename}"


def build_summary_message(name: str, frequency: str, period_label: str, summary: dict[str, Any]) -> str:
    freq = FREQUENCY_LABELS.get(frequency, frequency)
    return (
        f"📊 {name} ({freq}) — {period_label}\n"
        f"الإيرادات: {summary['revenue']:,.0f} ج.م ({summary['invoice_count']} فاتورة)\n"
        f"المصروفات: {summary['expenses']:,.0f} ج.م ({summary['expense_count']} بند)\n"
        f"الصافي: {summary['net']:,.0f} ج.م"
    )


def _notify_owners(db: Session, title: str, message: str) -> int:
    owners = (
        db.query(User)
        .filter(User.role.in_(["owner", "admin"]), User.is_active.is_(True))
        .all()
    )
    for owner in owners:
        db.add(Notification(user_id=owner.id, title=title, message=message, is_read=False))
    db.flush()
    return len(owners)


def run_schedule(db: Session, schedule: ReportSchedule) -> dict[str, Any]:
    """Execute one schedule: compute summary + deliver. Returns a result dict."""
    now = datetime.utcnow()
    start, end, period_label = period_for_frequency(schedule.frequency, now)
    summary = compute_period_summary(db, start, end)
    message = build_summary_message(schedule.name, schedule.frequency, period_label, summary)
    title = f"التقرير المالي {FREQUENCY_LABELS.get(schedule.frequency, '')}".strip()

    # Generate the PDF attachment (notification/WhatsApp still go out as text if this fails)
    pdf_path: Optional[str] = None
    pdf_url: Optional[str] = None
    pdf_filename = f"financial_report_{schedule.frequency}_{now.strftime('%Y%m%d')}.pdf"
    try:
        pdf_path, pdf_url = generate_summary_pdf(
            schedule.name, schedule.frequency, period_label, summary, now
        )
        schedule.last_pdf_url = pdf_url
    except Exception as exc:
        pdf_path, pdf_url = None, None

    channels: list[str] = []
    errors: list[str] = []
    if schedule.channel in ("notification", "both"):
        try:
            full_message = f"{message}\nPDF: {pdf_url}" if pdf_url else message
            count = _notify_owners(db, title, full_message)
            channels.append(f"notification:{count}")
        except Exception as exc:
            errors.append(f"notification: {exc}")
    if schedule.channel in ("whatsapp", "both"):
        try:
            from app.services.meta_whatsapp_service import (
                is_meta_whatsapp_configured,
                send_text_message,
                upload_and_send_pdf,
            )

            if not is_meta_whatsapp_configured():
                raise RuntimeError("WhatsApp غير مُعد في متغيرات البيئة")
            settings_row = db.query(BusinessSettings).first()
            phone = schedule.target_phone or (settings_row.shop_whatsapp if settings_row else None)
            if not phone:
                raise RuntimeError("لا يوجد رقم واتساب (حدد رقماً للجدولة أو رقم المحل)")
            if pdf_path:
                upload_and_send_pdf(
                    db,
                    to_phone=phone,
                    pdf_path=pdf_path,
                    filename=pdf_filename,
                    caption=message,
                )
                channels.append("whatsapp:document")
            else:
                send_text_message(
                    db,
                    to_phone=phone,
                    body=message,
                    message_type="scheduled_financial_report",
                )
                channels.append("whatsapp:text")
        except Exception as exc:
            errors.append(f"whatsapp: {exc}")

    schedule.last_run_at = now
    schedule.next_run_at = compute_next_run(schedule.frequency, now)
    schedule.last_status = "ok" if not errors or channels else "error"
    if errors and not channels:
        schedule.last_status = "error"
    schedule.last_summary = message if schedule.last_status == "ok" else "; ".join(errors)
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return {
        "schedule_id": schedule.id,
        "status": schedule.last_status,
        "channels": channels,
        "errors": errors,
        "summary": summary,
        "message": message,
        "pdf_url": pdf_url,
    }


def run_due_schedules(db: Session) -> list[dict[str, Any]]:
    """Run every active schedule whose next_run_at has passed."""
    now = datetime.utcnow()
    due = (
        db.query(ReportSchedule)
        .filter(ReportSchedule.is_active.is_(True), ReportSchedule.next_run_at <= now)
        .all()
    )
    results: list[dict[str, Any]] = []
    for schedule in due:
        try:
            results.append(run_schedule(db, schedule))
        except Exception as exc:
            try:
                schedule.last_run_at = now
                schedule.next_run_at = compute_next_run(schedule.frequency, now)
                schedule.last_status = "error"
                schedule.last_summary = str(exc)
                db.add(schedule)
                db.commit()
            except Exception:
                db.rollback()
            results.append({"schedule_id": schedule.id, "status": "error", "errors": [str(exc)]})
    return results


def cleanup_old_pdfs(keep_n: int = KEEP_PDFS) -> dict[str, Any]:
    """Remove older scheduled-report PDFs, keeping the most recent `keep_n` files."""
    out_dir = get_upload_path("scheduled_reports")
    if not out_dir.exists():
        return {"deleted": 0, "remaining": 0}
    files = sorted(
        [f for f in out_dir.glob("*.pdf")],
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    to_delete = files[keep_n:]
    deleted = 0
    for f in to_delete:
        try:
            f.unlink()
            deleted += 1
        except Exception:
            pass
    return {"deleted": deleted, "remaining": len(files) - deleted, "kept": len(files) - deleted + deleted}
