from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from app.models.pos_shift import PosShift
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.business_settings import BusinessSettings
from app.models.user import User
from app.core.clock import coerce_naive, salon_now
from app.core.working_hours import current_window
from app.services.activity_log_service import log_activity
from app.services.notification_service import create_notification

CASH_SETTLED_STATUSES = ("approved", "recorded")


def is_within_working_hours(db: Session) -> bool:
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return True # Default to open if no settings

    now = salon_now()
    return current_window(settings.working_hours, now) is not None


def next_closing_moment(db: Session):
    """Absolute moment the currently running window closes, or ``None``."""
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return None
    now = salon_now()
    window = current_window(settings.working_hours, now)
    if window is None:
        return None
    return window[2]


def _grace_period(settings: BusinessSettings) -> int:
    try:
        return max(int(getattr(settings, "shift_auto_close_grace_period", 30) or 30), 0)
    except (TypeError, ValueError):
        return 30


def _shift_totals(db: Session, shift: PosShift, closed_at: datetime) -> dict:
    """Sales/cash for a shift, bounded by the shift's own window.

    The previous implementation filtered only on ``created_at >= opened_at`` with
    no upper bound, so invoices raised after the auto-close silently fell outside
    every shift report. Bounding both ends is what makes the money reconcile.
    """
    opened_at = coerce_naive(shift.opened_at)
    upper = coerce_naive(closed_at) or opened_at

    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.created_by_user_id == shift.user_id,
            Invoice.created_at >= opened_at,
            Invoice.created_at <= upper,
        )
        .all()
    )
    expenses = (
        db.query(Expense)
        .filter(
            Expense.created_by_user_id == shift.user_id,
            Expense.created_at >= opened_at,
            Expense.created_at <= upper,
            Expense.status.in_(CASH_SETTLED_STATUSES),
        )
        .all()
    )

    total_sales = sum((Decimal(str(inv.total_amount or 0)) for inv in invoices), Decimal("0"))
    cash_sales = sum(
        Decimal(str(inv.total_amount or 0))
        for inv in invoices
        if (inv.payment_method or "").upper() == "CASH"
    )
    cash_expenses = sum(
        Decimal(str(expense.amount or 0))
        for expense in expenses
        if str(expense.payment_method or "cash").lower() == "cash"
    )
    discounts = sum(
        (Decimal(str(inv.discount_amount or 0)) for inv in invoices), Decimal("0")
    )

    return {
        "invoices": invoices,
        "expenses": expenses,
        "total_sales": total_sales,
        "cash_sales": cash_sales,
        "cash_expenses": cash_expenses,
        "discount_total": discounts,
        "invoice_count": len(invoices),
        "opened_at": opened_at,
        "closed_at": upper,
    }


def recompute_shift_totals(db: Session, shift: PosShift) -> dict:
    """Re-derive a closed shift's figures from its bounded window."""
    totals = _shift_totals(db, shift, coerce_naive(shift.closed_at) or datetime.now())
    shift.total_sales = totals["total_sales"]
    shift.invoice_count = totals["invoice_count"]
    shift.discount_total = totals["discount_total"]
    shift.expected_closing_cash = (
        Decimal(str(shift.opening_cash or 0)) + totals["cash_sales"] - totals["cash_expenses"]
    )
    return totals


def auto_close_expired_shifts(db: Session):
    """
    Closes all open POS shifts once the salon's closing time plus the configured
    grace period has passed.

    A shift younger than the grace period is never touched, so opening a shift a
    minute before closing does not get slammed shut underneath the cashier.
    """
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return 0

    grace = _grace_period(settings)
    now = salon_now()
    window = current_window(settings.working_hours, now)

    if window is not None and now <= (window[2] + timedelta(minutes=grace)):
        return 0

    open_shifts = (
        db.query(PosShift)
        .options(joinedload(PosShift.user))
        .filter(PosShift.status == "open")
        .all()
    )
    if not open_shifts:
        return 0

    managers = db.query(User).filter(User.role.in_(["manager", "owner"])).all()
    closed_count = 0

    for shift in open_shifts:
        opened_at = coerce_naive(shift.opened_at)
        if opened_at is not None and now < (opened_at + timedelta(minutes=grace)):
            continue

        totals = _shift_totals(db, shift, now)
        operator = shift.user.full_name if shift.user else "غير معروف"

        shift.status = "closed"
        shift.closed_at = now
        shift.total_sales = totals["total_sales"]
        shift.invoice_count = totals["invoice_count"]
        shift.discount_total = totals["discount_total"]
        shift.expected_closing_cash = (
            Decimal(str(shift.opening_cash or 0))
            + totals["cash_sales"]
            - totals["cash_expenses"]
        )
        shift.actual_closing_cash = shift.expected_closing_cash
        shift.closing_note = (
    "إغلاق تلقائي بواسطة النظام لنهاية ساعات العمل "
    f"(حتى {totals['closed_at'].strftime('%Y-%m-%d %H:%M')})"
        )

        log_activity(
            db,
            user_id=None,
            action="AUTO_CLOSE_SHIFT",
            entity_type="PosShift",
            entity_id=str(shift.id),
            description=(
                f"تم إغلاق وردية {operator} تلقائياً — "
                f"{totals['invoice_count']} فاتورة بإجمالي {totals['total_sales']} {settings.currency}"
            ),
            commit=False,
        )

        for mgr in managers:
            create_notification(
                db,
                user_id=mgr.id,
                title="إغلاق تلقائي للوردية",
                message=(
                    f"تم إغلاق وردية {operator} تلقائياً لنهاية الدوام. "
                    f"إجمالي المبيعات: {totals['total_sales']} {settings.currency} "
                    f"({totals['invoice_count']} فاتورة)."
                ),
                commit=False,
            )

        closed_count += 1

    if closed_count:
        db.commit()
    return closed_count
