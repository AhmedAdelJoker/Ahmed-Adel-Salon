"""`GET /owner/operating-summary` -- the cockpit data behind `/owner`.

Why one endpoint and not three
------------------------------
The cockpit needs a daily series for the sparkline, a ranking of staff, a
ranking of services, and the state of the trading day. Four separate requests
would be four chances to partially fail, and a partially failed dashboard is
worse than a broken one: the revenue chart renders while the staff table shows
"no data", and the reader has no way to tell that one of them failed rather than
one of them being empty.

So it is one request, and every section degrades together. A section that cannot
be computed is `null`, never a zero and never a placeholder -- the same rule the
occupancy fix established. An empty staff ranking and an unavailable one are
different facts.

Deduplication decisions worth stating, because they affect every number here:

  - Drafts are excluded. `is_draft` invoices are not money. This is the same
    filter the rest of the dashboard uses, deliberately: a second revenue rule
    here would make this panel disagree with the one above it.
  - There is no refund flag on `Invoice` in this schema, so refunds are not
    filtered out separately. If they are modelled elsewhere -- as an adjustment
    request, or as a negative line -- that is not visible here, and inventing a
    `status` column to filter on would have silently matched nothing. Worth
    confirming how a refund is actually recorded before treating any of these
    totals as net.
  - Revenue is attributed to `invoices.created_at`, the day the invoice was
    raised. Cash-basis reporting would use a payment timestamp; that is a
    different and equally defensible number, but mixing the two within one panel
    is not.
  - Service revenue comes from `invoice_items.total_price`, so a line that is
    product-only does not inflate the service ranking.

`day_status` describes the salon as it is right now. An open shift past the
working day is reported here as well as in `/owner/alerts`, because "what needs
you" and "what state is the business in" are different questions that happen to
share one row.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_owner_or_manager
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.pos_shift import PosShift

from app.core.clock import coerce_naive, salon_now, to_salon

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/owner", tags=["Owner Reports"])

# Long enough for a weekday cycle to be visible, short enough that each bar is
# readable in a cockpit-width sparkline.
DEFAULT_SERIES_DAYS = 14
# How long an open shift is tolerated before it is called out as overdue.
SHIFT_OVERDUE_HOURS = 12

# Drafts are not money. This matches the filter the rest of the dashboard
# applies, so the cockpit and the KPIs above it cannot disagree about what
# counts as revenue.
REVENUE_FILTERS = (Invoice.is_draft.is_(False),)


def _num(value: Any) -> float:
    return float(value or 0)


def _day_key(moment: datetime) -> date:
    """The salon-local calendar day a timestamp belongs to.

    `created_at` is stored in UTC. Filing a 23:30 UTC invoice under the UTC date
    puts it on the wrong day for a salon that closes at midnight, and the error
    is invisible in the total because the total does not care which day a
    payment landed on.
    """
    return to_salon(coerce_naive(moment) or moment).date()


def _daily_series(db: Session, today: date, days: int) -> list[dict[str, Any]]:
    """Revenue and appointment count per day, oldest first.

    Built from the raw rows rather than a SQL `GROUP BY` on a date expression,
    because SQLite and PostgreSQL disagree about how to truncate a timezone-aware
    timestamp to a day and that disagreement is invisible in tests that only ever
    run on SQLite. The row count here is bounded by the invoices in the window,
    not by the size of the table.
    """
    since = datetime.combine(today - timedelta(days=days - 1), datetime.min.time())

    invoices = (
        db.query(Invoice.created_at, Invoice.total_amount)
        .filter(Invoice.created_at >= since, *REVENUE_FILTERS)
        .all()
    )
    appointments = (
        db.query(Appointment.appointment_date)
        .filter(Appointment.appointment_date >= since.date())
        .all()
    )

    revenue_by_day: dict[date, float] = {}
    for created_at, total in invoices:
        key = _day_key(created_at)
        revenue_by_day[key] = revenue_by_day.get(key, 0.0) + _num(total)

    appointments_by_day: dict[date, int] = {}
    for (appt_date,) in appointments:
        if appt_date is None:
            continue
        key = appt_date.date() if isinstance(appt_date, datetime) else appt_date
        appointments_by_day[key] = appointments_by_day.get(key, 0) + 1

    series = []
    for offset in range(days):
        day = today - timedelta(days=days - 1 - offset)
        revenue = revenue_by_day.get(day, 0.0)
        series.append(
            {
                "date": day.isoformat(),
                "revenue": round(revenue, 2),
                "appointments": appointments_by_day.get(day, 0),
                "is_today": day == today,
            }
        )
    return series


def _previous_window_average(series: list[dict[str, Any]]) -> float | None:
    """Mean revenue over the days before today.

    Null when there is no history, so the comparison reads "no comparison
    available" instead of "today is up 100%". A baseline of zero makes every
    first day look like a triumph, which is the `_trend(0, x)` mistake in a
    different place.
    """
    history = [row for row in series if not row["is_today"]]
    if not history:
        return None
    return round(sum(row["revenue"] for row in history) / len(history), 2)


def _top_barbers(db: Session, since: datetime, limit: int) -> list[dict[str, Any]] | None:
    rows = (
        db.query(
            Employee.full_name,
            func.count(Invoice.id),
            func.sum(Invoice.total_amount),
        )
        .join(Invoice, Invoice.barber_id == Employee.id)
        .filter(Invoice.created_at >= since, *REVENUE_FILTERS)
        .group_by(Employee.id, Employee.full_name)
        .order_by(func.sum(Invoice.total_amount).desc())
        .limit(limit)
        .all()
    )

    if not rows:
        # No revenue in the window is a real, reportable state -- an empty
        # ranking, not an unavailable one.
        return []

    return [
        {
            "name": name,
            "invoices": int(invoice_count or 0),
            "revenue": round(_num(revenue), 2),
        }
        for name, invoice_count, revenue in rows
    ]


def _top_services(db: Session, since: datetime, limit: int) -> list[dict[str, Any]] | None:
    rows = (
        db.query(
            InvoiceItem.service_name,
            func.count(InvoiceItem.id),
            func.sum(InvoiceItem.total_price),
        )
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .filter(Invoice.created_at >= since, *REVENUE_FILTERS)
        .group_by(InvoiceItem.service_name)
        .order_by(func.sum(InvoiceItem.total_price).desc())
        .limit(limit)
        .all()
    )

    if not rows:
        return []

    return [
        {
            "name": name,
            "count": int(item_count or 0),
            "revenue": round(_num(revenue), 2),
        }
        for name, item_count, revenue in rows
    ]


def _day_status(db: Session, now: datetime) -> dict[str, Any]:
    """Is the salon trading, and since when.

    `open_shift` is null when nothing is open, which is different from an open
    shift with no money in it.
    """
    open_shift = (
        db.query(PosShift)
        .filter(PosShift.status == "open")
        .order_by(PosShift.opened_at.desc())
        .first()
    )

    last_closed = (
        db.query(PosShift)
        .filter(PosShift.status == "closed")
        .order_by(PosShift.closed_at.desc())
        .first()
    )

    shift: dict[str, Any] | None = None
    if open_shift is not None:
        opened = coerce_naive(open_shift.opened_at)
        hours_open = (
            round((to_salon(now) - opened).total_seconds() / 3600, 1)
            if opened
            else None
        )
        shift = {
            "id": open_shift.id,
            "user_id": open_shift.user_id,
            "opening_cash": _num(open_shift.opening_cash),
            "opened_at": open_shift.opened_at.isoformat()
            if open_shift.opened_at
            else None,
            "hours_open": hours_open,
            # An open shift this long is a cash discrepancy waiting to be argued
            # about, and it is also in /owner/alerts. Both are correct: this is
            # the state of the business, that is what needs a decision.
            "overdue": hours_open is not None and hours_open > SHIFT_OVERDUE_HOURS,
        }

    return {
        "now": now.isoformat(),
        "is_open": open_shift is not None,
        "open_shift": shift,
        "last_closed_at": last_closed.closed_at.isoformat()
        if last_closed and last_closed.closed_at
        else None,
        "last_closing_cash": _num(last_closed.actual_closing_cash)
        if last_closed
        else None,
    }


@router.get("/operating-summary")
def operating_summary(
    days: int = Query(DEFAULT_SERIES_DAYS, ge=7, le=90),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(require_owner_or_manager),
):
    """Daily series, staff and service rankings, and the state of the day.

    Sections are computed independently and each may be null. A failure in one
    does not blank the others, and none of them substitutes a number for a
    section it could not build.
    """
    now = salon_now()
    today = now.date()
    since = datetime.combine(today - timedelta(days=days - 1), datetime.min.time())

    daily: list[dict[str, Any]] | None = None
    baseline: float | None = None
    barbers: list[dict[str, Any]] | None = None
    services: list[dict[str, Any]] | None = None
    status: dict[str, Any] | None = None

    # Each section degrades on its own so a single failure does not blank the
    # cockpit, but the exception is logged rather than discarded. A bare
    # `except Exception: pass` around a section makes the section look like data
    # rather than like a failure, and costs an hour to debug the next time.
    try:
        daily = _daily_series(db, today, days)
        baseline = _previous_window_average(daily)
    except Exception:
        logger.exception("operating-summary: daily series unavailable")
        daily = None

    try:
        barbers = _top_barbers(db, since, limit)
    except Exception:
        logger.exception("operating-summary: staff ranking unavailable")
        barbers = None

    try:
        services = _top_services(db, since, limit)
    except Exception:
        logger.exception("operating-summary: service ranking unavailable")
        services = None

    try:
        status = _day_status(db, now)
    except Exception:
        logger.exception("operating-summary: day status unavailable")
        status = None

    return {
        "daily": daily,
        "previous_window_average": baseline,
        "top_barbers": barbers,
        "top_services": services,
        "day_status": status,
        "generated_at": now.isoformat(),
    }