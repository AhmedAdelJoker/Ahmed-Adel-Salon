"""`GET /owner/alerts` -- the real thing behind the alerts page.

Why this exists
---------------
`/owner/alerts` rendered five hardcoded alerts. The first said a suspended
employee still had live permissions; the second said invoice INV-9020 had been
edited after payment; the third reported a 3am login from an unrecognised device.
None of them came from this database. `useState(INITIAL_ALERTS)`, no fetch, and
no banner saying any of it was illustrative.

That is the same defect as the dashboard's invented 18,750 EGP, and worse here:
the dashboard's fiction is mitigated by a label, whereas this page was a
security surface with no real findings in it. An owner either chases a
non-event or learns to dismiss the page, and a page that cries wolf is not a
security page.

So this aggregates what is actually pending. Every source below already existed
and already wrote rows; nothing new needed to be invented to build it.

Sources
-------
    invoice adjustment requests    status = pending
    discount approvals             status = pending
    unread notifications           addressed to this owner, or to their role
    expiring employee documents    expiry_date inside the warning window
    low stock                      quantity <= min_quantity_alert
    unclosed shifts                opened before the salon's day ended

What it does not do
-------------------
It does not guess severity from the shape of a row. `priority` is derived from
which table the finding came from and how time-bound it is, and that mapping is
one function so it can be read and argued with rather than scattered.

It returns an empty list when nothing is pending, and the page says so. That is
the whole point: an empty alerts page has to mean "nothing needs you", because
the alternative is a page nobody reads.

One request, not seven. A dashboard that opens N requests is N chances to
partially fail, and the result of a partial failure is a count that is
confidently wrong -- which is the failure mode this endpoint exists to remove.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.db.session import get_db
from app.models.employee_document import EmployeeDocument
from app.models.notification import Notification
from app.models.pos_shift import PosShift
from app.models.product import Product
from app.models.user import User

from app.core.clock import coerce_naive, salon_now, to_salon

router = APIRouter(prefix="/owner", tags=["Owner Reports"])

# How far ahead an expiring document counts as worth interrupting someone for.
DOCUMENT_WARNING_DAYS = 30
# A shift still open this long after opening is a cash discrepancy waiting to be
# argued about. Measured from `opened_at`, not from the current time, so the
# finding is about how long it has been open rather than drifting as the clock
# moves.
SHIFT_GRACE_HOURS = 12


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _sort_key(value: datetime | None) -> datetime:
    """Sort on a real instant, not on the ISO string.

    The API mixes `DateTime(timezone=True)` columns, which SQLite hands back
    naive and PostgreSQL hands back aware. Comparing those ISO strings
    lexicographically orders by offset before by time, so a `+02:00` row from
    yesterday sorts above a `Z` row from an hour ago. Normalising through
    `coerce_naive` makes both comparable.
    """
    return coerce_naive(value) or datetime.min


def _document_alerts(db: Session, now: datetime) -> list[dict[str, Any]]:
    horizon = now + timedelta(days=DOCUMENT_WARNING_DAYS)
    rows = db.query(EmployeeDocument).filter(
        EmployeeDocument.expiry_date.isnot(None),
        EmployeeDocument.expiry_date <= horizon,
    ).all()
    alerts = []
    for doc in rows:
        expiry = doc.expiry_date
        if isinstance(expiry, datetime):
            expiry = expiry.date()
        days = (expiry - now.date()).days
        alerts.append(
            {
                "key": f"document-{doc.id}",
                "source": "employee_documents",
                "title": "مستند موظف قارب على الانتهاء",
                "message": (
                    f"مستند رقم {doc.id} ينتهي في {expiry:%Y-%m-%d}"
                    + (f" (بعد {days} يوم)" if days >= 0 else " — منتهٍ بالفعل")
                ),
                # A document that already expired is worse than one about to.
                "priority": "high" if days < 0 else "medium",
                "occurred_at": _iso(doc.created_at), "_sort_at": doc.created_at,
                "destination": "/owner/hr",
            }
        )
    return alerts


def _low_stock_alerts(db: Session) -> list[dict[str, Any]]:
    rows = (
        db.query(Product)
        .filter(
            Product.quantity.isnot(None),
            Product.min_quantity_alert.isnot(None),
            Product.quantity <= Product.min_quantity_alert,
        )
        .all()
    )
    return [
        {
            "key": f"low-stock-{p.id}",
            "source": "products",
            "title": "مخزون تحت الحد الأدنى",
            "message": (
                f"المنتج «{p.name}» بقي {p.quantity} وحد التنبيه "
                f"{p.min_quantity_alert}"
            ),
            "priority": "high" if float(p.quantity or 0) == 0 else "medium",
            "occurred_at": None,
            "_sort_at": None,
            "destination": "/inventory",
        }
        for p in rows
    ]


def _open_shift_alerts(db: Session, now: datetime) -> list[dict[str, Any]]:
    """Shifts still open well past the end of the working day.

    Compares in salon wall-clock via `coerce_naive`, so a SQLite row stored
    naive and a PostgreSQL row stored aware are judged against the same
    cutoff instead of one of them always looking stale.
    """
    cutoff = to_salon(now) - timedelta(hours=SHIFT_GRACE_HOURS)
    rows = db.query(PosShift).filter(PosShift.status == "open").all()

    alerts = []
    for shift in rows:
        opened = coerce_naive(shift.opened_at)
        if opened is not None and opened > cutoff:
            continue
        alerts.append(
            {
                "key": f"open-shift-{shift.id}",
                "source": "pos_shifts",
                "title": "وردية مفتوحة منذ نهاية الدوام",
                "message": (
                    f"الوردية رقم {shift.id} ما زالت مفتوحة "
                    f"رأس المال الافتتاحي {shift.opening_cash}"
                ),
                "priority": "high",
                "occurred_at": _iso(shift.opened_at), "_sort_at": shift.opened_at,
                "destination": "/owner/cashbox",
            }
        )
    return alerts


@router.get("/alerts")
def list_owner_alerts(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Everything waiting for the owner's decision, newest first.

    Deliberately owner-only. Several of these rows are other people's requests
    -- an adjustment a cashier asked for, a discount a manager proposed -- and a
    manager can see their own. The count an owner acts on should not be visible
    to someone who cannot act on it.
    """
    from app.models.invoice_adjustment_request import InvoiceAdjustmentRequest
    from app.models.discount_approval_request import DiscountApprovalRequest
    from app.models.invoice import Invoice

    now = salon_now()
    alerts: list[dict[str, Any]] = []

    # Joined to `invoices` for `invoice_no`. The owner decides on these against
    # a number printed on a receipt; an internal `invoice_id` would send them to
    # the right page and tell them nothing about which invoice it is.
    adjustments = (
        db.query(InvoiceAdjustmentRequest, Invoice.invoice_no)
        .join(Invoice, Invoice.id == InvoiceAdjustmentRequest.invoice_id)
        .filter(InvoiceAdjustmentRequest.status == "pending")
        .order_by(InvoiceAdjustmentRequest.created_at.desc())
        .all()
    )
    alerts += [
        {
            "key": f"adjustment-{r.id}",
            "source": "invoice_adjustment_requests",
            "title": "طلب تعديل فاتورة بانتظار الموافقة",
            "message": (
                f"طلب {r.request_type} على الفاتورة {invoice_no or r.invoice_id}"
            ),
            "priority": "high",
            "occurred_at": _iso(r.created_at),
            "_sort_at": r.created_at,
            "destination": "/owner/adjustment-requests",
        }
        for r, invoice_no in adjustments
    ]

    discounts = (
        db.query(DiscountApprovalRequest, Invoice.invoice_no)
        .join(Invoice, Invoice.id == DiscountApprovalRequest.invoice_id)
        .filter(DiscountApprovalRequest.status == "pending")
        .order_by(DiscountApprovalRequest.id.desc())
        .all()
    )
    alerts += [
        {
            "key": f"discount-{r.id}",
            "source": "discount_approval_requests",
            "title": "طلب خصم بانتظار الموافقة",
            "message": (
                f"خصم قدره {r.requested_discount_amount} على الفاتورة "
                f"{invoice_no or r.invoice_id}"
            ),
            "priority": "medium",
            "occurred_at": None,
            "_sort_at": None,
            "destination": "/discount-approvals",
        }
        for r, invoice_no in discounts
    ]

    unread = (
        db.query(Notification)
        .filter(
            Notification.is_read.is_(False),
            (Notification.user_id == current_user.id)
            | (Notification.user_role == current_user.role),
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    alerts += [
        {
            "key": f"notification-{n.id}",
            "source": "notifications",
            "title": n.title or "إشعار",
            "message": n.message or "",
            "priority": "low",
            "occurred_at": _iso(n.created_at), "_sort_at": n.created_at,
            "destination": "/notifications",
        }
        for n in unread
    ]

    alerts += _document_alerts(db, now)
    alerts += _low_stock_alerts(db)
    alerts += _open_shift_alerts(db, now)

    # Highest severity first, newest first inside each severity.
    #
    # Bucketed rather than sorted with one clever key, and not two chained sorts
    # relying on `list.sort` being stable. Both of those are one careless edit
    # away from silently inverting the order, and getting this wrong hides the
    # urgent row under the trivial ones -- the failure mode is a page that looks
    # correct and is useless.
    #
    # An alert with no timestamp -- a stock threshold crossed silently -- sorts
    # last inside its severity, which is what an undated finding deserves.
    ordered: list[dict[str, Any]] = []
    for severity in ("high", "medium", "low"):
        bucket = [a for a in alerts if a["priority"] == severity]
        bucket.sort(key=lambda a: _sort_key(a["_sort_at"]), reverse=True)
        ordered.extend(bucket)
    # Anything with an unrecognised priority still gets shown, after the rest.
    ordered.extend(a for a in alerts if a["priority"] not in ("high", "medium", "low"))
    alerts = ordered

    # `_sort_at` is internal bookkeeping; it is not part of the contract.
    for alert in alerts:
        alert.pop("_sort_at", None)

    return {
        "alerts": alerts[:limit],
        "counts": {
            "total": len(alerts),
            "high": sum(1 for a in alerts if a["priority"] == "high"),
            "medium": sum(1 for a in alerts if a["priority"] == "medium"),
            "low": sum(1 for a in alerts if a["priority"] == "low"),
        },
        "generated_at": now.isoformat(),
        "sources": [
            "invoice_adjustment_requests",
            "discount_approval_requests",
            "notifications",
            "employee_documents",
            "products",
            "pos_shifts",
        ],
    }