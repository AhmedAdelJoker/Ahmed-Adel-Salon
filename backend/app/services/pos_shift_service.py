from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload
from app.models.pos_shift import PosShift
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.expense import Expense
from app.models.business_settings import BusinessSettings
from app.models.user import User
from app.core.clock import coerce_naive, salon_now, utc_now_naive, utc_to_salon_naive
from app.core.working_hours import current_window
from app.services.activity_log_service import log_activity
from app.services.notification_service import create_notification
from app.services.runtime_settings_service import get_runtime_settings

CASH_SETTLED_STATUSES = ("approved", "recorded")

DEFAULT_AUTO_LOCK_HOURS = 24
DEFAULT_AUTO_CLOSE_ENABLED = True


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


def _auto_lock_hours() -> float:
    """Safety-net age limit for open shifts, in hours (0 disables it)."""
    rules = get_runtime_settings(
        "financial_rules", {"autoLockShiftHours": DEFAULT_AUTO_LOCK_HOURS}
    )
    try:
        return max(
            0.0,
            float(
                rules.get("autoLockShiftHours", DEFAULT_AUTO_LOCK_HOURS) or 0
            ),
        )
    except (TypeError, ValueError):
        return float(DEFAULT_AUTO_LOCK_HOURS)


def _auto_close_enabled() -> bool:
    """Master switch. Typed strictly like the financial-rules payload so a
    stale hand-edited runtime file still reads as a real boolean."""
    rules = get_runtime_settings(
        "financial_rules",
        {"enableAutoShiftClose": DEFAULT_AUTO_CLOSE_ENABLED},
    )
    value = rules.get("enableAutoShiftClose", DEFAULT_AUTO_CLOSE_ENABLED)
    if isinstance(value, str):
        value = value.strip().lower() not in ("", "false", "0", "no", "off")
    return bool(value)


def shift_window_totals(
    db: Session,
    *,
    user_id: int,
    start: datetime,
    end: datetime,
    opening_cash: Decimal | None = None,
    shift_id: int | None = None,
) -> dict:
    """The one implementation of the shift money arithmetic.

    Every figure the POS shows or stamps is derived here: the live tiles, the
    close arithmetic, the archived reprint and the auto-closer. Those were
    four separate copies of the same sums, and four copies are four chances
    for the drawer to disagree with the receipt — a window or an expense
    filter changed in one place and not in the others, and the shift closed
    on a number the cashier never saw.

    The window carries a 1s tolerance at both ends. SQLite stores server-side
    CURRENT_TIMESTAMP without microseconds while bound datetimes carry
    ".000000", so an invoice created in the same wall-clock second as the
    shift opened (or closed) would otherwise string-compare as outside the
    window and silently drop out of the totals.

    When ``shift_id`` is passed (the Phase-1+ link landed), the shift's own
    attribution wins. Invoices that predate the link carry ``shift_id = NULL``
    and fall back to the same (user, window) pairing, so historical shifts keep
    reconciling exactly as they did before the link existed.
    """
    lower = start - timedelta(seconds=1)
    upper = end + timedelta(seconds=1)

    invoice_conditions = [
        Invoice.created_at >= lower,
        Invoice.created_at <= upper,
        Invoice.is_draft == False,  # noqa: E712  (SQLAlchemy needs the literal)
    ]
    if shift_id is not None:
        invoice_conditions.append(
            or_(
                Invoice.shift_id == shift_id,
                and_(
                    Invoice.shift_id.is_(None),
                    Invoice.created_by_user_id == user_id,
                ),
            )
        )
    else:
        invoice_conditions.append(Invoice.created_by_user_id == user_id)

    invoices = (
        db.query(Invoice)
        .filter(*invoice_conditions)
        .all()
    )
    expenses = (
        db.query(Expense)
        .filter(
            Expense.created_by_user_id == user_id,
            Expense.created_at >= start,
            Expense.created_at <= upper,
            Expense.status.in_(CASH_SETTLED_STATUSES),
        )
        .all()
    )

    total_sales = Decimal("0")
    cash_sales = Decimal("0")
    card_sales = Decimal("0")
    split_sales = Decimal("0")
    discount_total = Decimal("0")
    for inv in invoices:
        amount = Decimal(str(inv.total_amount or 0))
        total_sales += amount
        discount_total += Decimal(str(inv.discount_amount or 0))
        method = (inv.payment_method or "").upper()
        if method == "CASH":
            cash_sales += amount
        elif method == "CARD":
            card_sales += amount
        else:
            split_sales += amount

    invoice_ids = [inv.id for inv in invoices]
    service_count = 0
    product_count = 0
    if invoice_ids:
        items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id.in_(invoice_ids)).all()
        for item in items:
            if item.service_id:
                service_count += item.quantity or 1
            elif item.product_id:
                product_count += item.quantity or 1

    total_expenses = sum(
        (Decimal(str(expense.amount or 0)) for expense in expenses), Decimal("0")
    )
    cash_expenses = sum(
        (
            Decimal(str(expense.amount or 0))
            for expense in expenses
            if str(expense.payment_method or "cash").lower() == "cash"
        ),
        Decimal("0"),
    )
    expected_closing_cash = (
        Decimal(str(opening_cash or 0)) + cash_sales - cash_expenses
    )

    return {
        "invoices": invoices,
        "expenses": expenses,
        "total_sales": total_sales,
        "cash_sales": cash_sales,
        "card_sales": card_sales,
        "split_sales": split_sales,
        "discount_total": discount_total,
        "invoice_count": len(invoices),
        "service_count": service_count,
        "product_count": product_count,
        "total_expenses": total_expenses,
        "cash_expenses": cash_expenses,
        "expected_closing_cash": expected_closing_cash,
    }


def _shift_totals(db: Session, shift: PosShift, closed_at: datetime) -> dict:
    """Sales/cash for a shift, bounded by the shift's own window.

    The previous implementation filtered only on ``created_at >= opened_at`` with
    no upper bound, so invoices raised after the auto-close silently fell outside
    every shift report. Bounding both ends is what makes the money reconcile.
    """
    opened_at = coerce_naive(shift.opened_at)
    upper = coerce_naive(closed_at) or opened_at

    totals = shift_window_totals(
        db,
        user_id=shift.user_id,
        start=opened_at,
        end=upper,
        opening_cash=shift.opening_cash,
        shift_id=shift.id,
    )
    return {**totals, "opened_at": opened_at, "closed_at": upper}


def recompute_shift_totals(db: Session, shift: PosShift) -> dict:
    """Re-derive a closed shift's figures from its bounded window."""
    # A closed shift missing closed_at is a data repair case; "now" is the only
    # sane bound, and it must be the same clock the stamps hold.
    totals = _shift_totals(db, shift, coerce_naive(shift.closed_at) or utc_now_naive())
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

    Additionally, ``financial_rules.autoLockShiftHours`` acts as a safety net:
    any open shift older than that many hours is closed even mid-window or when
    working hours are not configured at all (0 disables the net entirely).

    ## One clock per question

    Two clocks are involved and mixing them is a money bug, so each is used for
    exactly one thing:

    * ``salon_now()`` answers wall-clock questions — is the shop inside its
      working hours, has the grace period passed. Never written to a column.
    * ``utc_now_naive()`` is the clock of stored timestamps (``opened_at`` comes
      from SQLite's ``CURRENT_TIMESTAMP``, invoices are UTC). It stamps
      ``closed_at`` and bounds the invoice window.

    ``closed_at`` used to be written with the salon clock while ``opened_at``
    was UTC, so a closed shift's window sat three hours off the invoices it was
    supposed to contain: the reprint could pull in sales raised hours after the
    close. Shift *ages* were already measured in UTC (subtracting the salon
    wall from a fresh stamp would claim a barely-opened shift was three hours
    old and slam it shut) — the stamping was the half that leaked.
    """
    settings = db.query(BusinessSettings).first()
    if not _auto_close_enabled():
        return 0
    grace = _grace_period(settings)
    now = salon_now()
    now_utc = utc_now_naive()
    lock_hours = _auto_lock_hours()

    hours_known = bool(settings and settings.working_hours)
    if not hours_known and lock_hours <= 0:
        return 0

    window = current_window(settings.working_hours, now) if hours_known else None
    in_active_window = bool(
        hours_known
        and window is not None
        and now <= (window[2] + timedelta(minutes=grace))
    )

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
    currency = getattr(settings, "currency", None) or "ج.م"

    def _close_shift(shift: PosShift, reason_note: str) -> None:
        nonlocal closed_count
        totals = _shift_totals(db, shift, now_utc)
        operator = shift.user.full_name if shift.user else "غير معروف"

        shift.status = "closed"
        shift.closed_at = now_utc
        shift.total_sales = totals["total_sales"]
        shift.invoice_count = totals["invoice_count"]
        shift.discount_total = totals["discount_total"]
        shift.expected_closing_cash = (
            Decimal(str(shift.opening_cash or 0))
            + totals["cash_sales"]
            - totals["cash_expenses"]
        )
        shift.actual_closing_cash = shift.expected_closing_cash
        # The note is read by a human, so it carries the salon's wall clock
        # even though the column it accompanies holds UTC.
        shift.closing_note = (
            f"{reason_note} (حتى {utc_to_salon_naive(totals['closed_at']).strftime('%Y-%m-%d %H:%M')})"
        )

        log_activity(
            db,
            user_id=None,
            action="AUTO_CLOSE_SHIFT",
            entity_type="PosShift",
            entity_id=str(shift.id),
            description=(
                f"تم إغلاق وردية {operator} تلقائياً — "
                f"{totals['invoice_count']} فاتورة بإجمالي {totals['total_sales']} {currency}"
            ),
            commit=False,
        )

        for mgr in managers:
            create_notification(
                db,
                user_id=mgr.id,
                title="إغلاق تلقائي للوردية",
                message=(
                    f"تم إغلاق وردية {operator} تلقائياً. "
                    f"إجمالي المبيعات: {totals['total_sales']} {currency} "
                    f"({totals['invoice_count']} فاتورة)."
                ),
                commit=False,
            )

        closed_count += 1

    end_of_hours_note = "إغلاق تلقائي بواسطة النظام لنهاية ساعات العمل"
    safety_note = (
        "إغلاق تلقائي احترازي لتجاوز الوردية مدة القفل المسموحة "
        f"({lock_hours:g} ساعة)"
    )

    for shift in open_shifts:
        opened_at_utc = coerce_naive(shift.opened_at)
        if opened_at_utc is None:
            continue

        age_minutes = (now_utc - opened_at_utc).total_seconds() / 60.0
        over_aged = lock_hours > 0 and age_minutes >= lock_hours * 60

        if in_active_window and not over_aged:
            continue
        if not over_aged and age_minutes < grace:
            continue

        _close_shift(shift, safety_note if over_aged else end_of_hours_note)

    if closed_count:
        db.commit()
    return closed_count
