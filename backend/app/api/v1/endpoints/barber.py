from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from datetime import date, datetime, timedelta
from typing import Any, List, Optional
from decimal import Decimal, ROUND_HALF_UP
import logging

from app.services.websocket import manager

from app.api import deps
from app.models.invoice import Invoice
from app.models.employee import Employee
from app.models.employee_working_hour import EmployeeWorkingHour
from app.models.employee_time_off import EmployeeTimeOff
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.customer import Customer
from app.models.salary_advance import SalaryAdvance
from app.core.clock import salon_now, utc_now_naive
from app.core.pos import normalize_payment_method
from app.services.loyalty_service import sweep_expired_points
from pydantic import BaseModel, ConfigDict


router = APIRouter()
logger = logging.getLogger(__name__)


# ── Money ──────────────────────────────────────────────────────────────────
#
# Every monetary column in this project is `Numeric(10, 2)`, which SQLAlchemy
# hands back as a `Decimal`. Multiplying a `Decimal` by a `float` raises
# `TypeError` — both operand dunders return `NotImplemented`.
#
# That is not hypothetical: `earnings-summary` computed `Decimal * float` and
# returned HTTP 500 for every barber who had made a sale that day, while
# silently passing for one with no sales (the `or 0` fallback swapped the
# Decimal for an int). Commission is therefore calculated in `Decimal`
# throughout, and only converted to `float` at the JSON boundary.
#
# The helpers below exist so no endpoint has to remember that.

MONEY_EXP = Decimal("0.01")


def _dec(value: Any) -> Decimal:
    """Coerce anything (Decimal, float, int, str, None) to a Decimal.

    `float` is routed through `str` on purpose: `Decimal(0.1)` carries the
    binary error of the float it was built from, whereas `Decimal("0.1")` does
    not. At money scale that difference is real.
    """
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _money(value: Any) -> float:
    """Quantise to 2dp and return a JSON-safe float.

    Quantising here rather than at the call site is what stops a figure like
    `33.33333333` reaching the barber's screen.
    """
    return float(_dec(value).quantize(MONEY_EXP, rounding=ROUND_HALF_UP))


def _rate_decimal(barber: Employee | None) -> Decimal:
    """The barber's commission rate as a Decimal fraction, e.g. `0.15`.

    A **0% rate is a real setting** -- a barber on straight salary earns no
    commission -- so it has to survive. The old `getattr(barber,
    "commission_rate", None) or 15` could not tell "no rate configured" apart
    from "configured as zero": `Decimal("0")` is falsy in Python, so a barber
    explicitly set to 0% was silently paid 15%. That inflated both the earnings
    summary and the commission rows. Default only when the column is NULL.
    """
    rate = getattr(barber, "commission_rate", None)
    percent = _dec(rate) if rate is not None else Decimal("15")
    return percent / Decimal("100")


def _commission(sales: Any, rate: Decimal) -> Decimal:
    return _dec(sales) * rate


def _period_bounds(reference: date, period: str) -> tuple[date, date]:
    """Return the inclusive `[start, end)` window for a named period.

    ## Why this exists

    The old code filtered with `func.date(created_at) >= start` and **no upper
    bound**, then built three periods by varying only the lower bound:

        today  = _sales(today)                 # >= today
        week   = _sales(today - 6 days)        # >= 6 days ago
        month  = _sales(today.replace(day=1))  # >= 1st of month

    So `week` was a superset of `today` and `month` a superset of `week` by
    construction — three cumulative-to-date numbers presented as three distinct
    periods, and "week" would silently absorb any invoice dated in the future.
    Each period now gets a real closed window.
    """
    if period == "today":
        return reference, reference + timedelta(days=1)
    if period == "week":
        # Rolling 7 days, ending today inclusive.
        return reference - timedelta(days=6), reference + timedelta(days=1)
    if period == "month":
        start = reference.replace(day=1)
        return start, reference + timedelta(days=1)
    if period == "year":
        start = reference.replace(month=1, day=1)
        return start, reference + timedelta(days=1)
    # Unknown period: treat as the rolling week rather than silently meaning
    # "everything ever", which is what an unmatched `else` used to do.
    return reference - timedelta(days=6), reference + timedelta(days=1)


# Which canonical payment method lands in which of the three buckets the
# frontend already charts. `normalize_payment_method` collapses the aliases
# (`card` -> `bank_card`, `wallet` -> `vodafone_cash`, `transfer` -> `instapay`),
# so matching on the normalised names covers both spellings.
_PAYMENT_BUCKETS = {
    "cash": "cash",
    "vodafone_cash": "transfer",
    "instapay": "transfer",
    "bank_card": "card",
}


class TimeOffPayload(BaseModel):
    start_date: str
    end_date: Optional[str] = None
    reason: Optional[str] = None
    type: Optional[str] = "vacation"


class WorkingHoursPayload(BaseModel):
    working_hours: List[dict]


class TipPayload(BaseModel):
    amount: float


class NotificationSettingsPayload(BaseModel):
    """The barber's notification switches.

    Accepts **both** wire shapes, because the deployed client sends the flat one:

        {"new_appointment": false, "tips": true}          # what the client sends
        {"notifications": {"new_appointment": false}}    # the documented one

    `notifications` used to be a required field, which made the flat shape a
    hard `422` — the settings page could not save at all. It is optional here,
    and the handler falls back to the flat keys.
    """

    notifications: Optional[dict] = None

    # Captures the flat keys without re-declaring all six, so a new switch does
    # not need a schema change on both sides at once.
    model_config = ConfigDict(extra="allow")

    @property
    def flat(self) -> dict:
        """Every key that is not the envelope, lowercased."""
        return {
            k.lower(): v
            for k, v in (self.model_extra or {}).items()
            if k.lower() != "notifications"
        }


# The six switches `NotificationsTab` renders, with the defaults the profile
# page starts from. Anything outside this set is ignored on save, so a stray
# field cannot turn "no notifications" into a truthy master flag.
_DEFAULT_NOTIFICATIONS = {
    "new_appointment": True,
    "appointment_reminder": True,
    "appointment_cancelled": True,
    "shift_reminder": True,
    "tips": True,
    "marketing": False,
}


class ClientPayload(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


# Columns the queue may be sorted by. An allowlist, not `getattr`, because the
# sort key is client-supplied and a class attribute that is not a column (say
# `metadata`) raises as soon as `.desc()` is called on it.
_SORTABLE_QUEUE_COLUMNS = {
    "appointment_time": Appointment.appointment_time,
    "appointment_date": Appointment.appointment_date,
    "status": Appointment.status,
    "created_at": Appointment.created_at,
    "total_estimated_price": Appointment.total_estimated_price,
}


def _resolve_barber_id(current_user) -> Optional[int]:
    return current_user.barber_id or current_user.employee_id


def _get_barber(db: Session, current_user) -> int:
    """Resolve the current user's employee id (kept db arg for call-site compat)."""
    barber_id = _resolve_barber_id(current_user)
    if not barber_id:
        raise HTTPException(status_code=404, detail="Barber profile not found")
    return barber_id


def _assert_appointment_access(appointment: Appointment, current_user) -> None:
    if current_user.role == "barber":
        barber_id = _resolve_barber_id(current_user)
        if barber_id != appointment.barber_id:
            raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذا الحجز")

@router.get("/stats")
def get_barber_stats(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
    period: str = "today" # today, week, month
) -> Any:
    """
    Get detailed financial and performance stats for the barber.
    """
    if current_user.role != "barber" and current_user.role not in ["admin", "owner", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get barber profile from Employee table
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        raise HTTPException(status_code=404, detail="Barber profile not found")

    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barber profile not found")

    today = salon_now().date()

    # 1. Total Services Count (using appointment_date instead of start_at)
    # Note: also counting 'ready_for_payment' as completed from barber's perspective
    service_count = db.query(func.count(Appointment.id)).filter(
        Appointment.barber_id == barber.id,
        Appointment.status.in_(["completed", "ready_for_payment"]),
        Appointment.appointment_date == today
    ).scalar() or 0

    # 2. Distinct customers served today.
    #
    # This was `service_count` again under a second name, so the dashboard
    # showed the same figure twice with two different captions. A barber who
    # served 4 appointments to 3 people was told "3 services, 3 customers".
    distinct_customers = db.query(
        func.count(func.distinct(Appointment.customer_id))
    ).filter(
        Appointment.barber_id == barber.id,
        Appointment.status.in_(["completed", "ready_for_payment"]),
        Appointment.appointment_date == today,
        Appointment.customer_id.isnot(None),
    ).scalar() or 0

    # 3. Commissions (Calculated from Invoices linked to this barber)
    #
    # `is_draft` is filtered here: a draft is a POS basket that was never paid
    # for, and counting it as sales would report commission the barber has not
    # earned. `earnings-summary` has always filtered it; this endpoint did not,
    # so the two disagreed whenever a draft was open.
    total_sales = db.query(func.sum(Invoice.subtotal_amount)).filter(
        Invoice.barber_id == barber.id,
        Invoice.is_draft == False,  # noqa: E712 — SQL, not Python
        func.date(Invoice.created_at) == today
    ).scalar() or 0

    rate = _rate_decimal(barber)
    total_commission = _commission(total_sales, rate)

    # 4. Advances actually received and not yet deducted from a payroll run.
    #
    # This was hard-coded to `0.0` with the comment "Mock value for now", which
    # made `net_due` equal the gross commission unconditionally: a barber who
    # had taken an advance was shown money they did not have coming.
    # `SalaryAdvance` already carries `employee_id` and `is_deducted`, and is
    # indexed on both, so the data to answer this has always been there.
    total_advances = db.query(func.sum(SalaryAdvance.amount)).filter(
        SalaryAdvance.employee_id == barber.id,
        SalaryAdvance.is_deducted == False,  # noqa: E712
    ).scalar() or 0

    return {
        "services_today": service_count,
        "total_customers": distinct_customers,
        "commission_rate": f"{_dec(barber.commission_rate or 15):.0f}%",
        "earned_commission": _money(total_commission),
        "received_advances": _money(total_advances),
        "net_due": _money(_dec(total_commission) - _dec(total_advances)),
        "commitment": {
            "absence_days": 0,
            "late_hours": 0
        }
    }

@router.get("/queue")
def get_barber_queue(
    response: Response = None,
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(200, ge=1, le=500, description="Max records per section"),
    page: Optional[int] = Query(None, ge=1, description="Optional 1-indexed page"),
    page_size: Optional[int] = Query(None, ge=1, le=500, description="Optional page size"),
    sort: Optional[str] = Query(None, description="Sort field. '-' prefix for DESC"),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """
    Get the barber's specific queue (waiting and completed).

    Phase 2 slice: bounded + paginated + X-Total-Count headers.
    Previously hard-capped at 200 with no count headers — kept 200 as
    default so callers without params see identical behavior (backward compat).
    N+1 already fixed via joinedload(customer/services) for each section.
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        return {"waiting": [], "completed": []}

    today = salon_now().date()

    # Base queries (eager-load customer + services — N+1 fixed)
    waiting_q = db.query(Appointment).options(
        joinedload(Appointment.customer),
        selectinload(Appointment.services),
    ).filter(
        Appointment.barber_id == barber_id,
        Appointment.status.in_(["waiting", "in-service", "pending"]),
        Appointment.appointment_date == today
    )
    completed_q = db.query(Appointment).options(
        joinedload(Appointment.customer),
        selectinload(Appointment.services),
    ).filter(
        Appointment.barber_id == barber_id,
        Appointment.status.in_(["completed", "ready_for_payment"]),
        Appointment.appointment_date == today
    )

    # Phase 2: normalize page/page_size -> skip/limit
    eff_skip = skip
    eff_limit = limit
    if page is not None and page_size is not None:
        eff_skip = (page - 1) * page_size
        eff_limit = page_size

    # Counts for headers (before offset/limit)
    waiting_total = waiting_q.count()
    completed_total = completed_q.count()

    if response is not None:
        response.headers["X-Total-Count"] = str(waiting_total + completed_total)
        response.headers["X-Waiting-Count"] = str(waiting_total)
        response.headers["X-Completed-Count"] = str(completed_total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)

    def _serialize_queue_apt(apt: Appointment) -> dict:
        cust = getattr(apt, "customer", None)
        services = getattr(apt, "services", None) or []
        customer_name = (
            f"{cust.first_name} {(cust.last_name or '')}".strip()
            if cust and getattr(cust, "first_name", None)
            else "عميل نقدي"
        )
        service_name = ", ".join(
            s.service_name_snapshot for s in services if getattr(s, "service_name_snapshot", None)
        ) or "خدمة"
        start_time = (
            apt.appointment_time.strftime("%H:%M")
            if getattr(apt, "appointment_time", None)
            else ""
        )
        return {
            "id": apt.id,
            "customer_id": apt.customer_id,
            "customer_name": customer_name,
            "customer_phone": getattr(cust, "phone", "") if cust else "",
            "service_name": service_name,
            "appointment_date": str(apt.appointment_date) if getattr(apt, "appointment_date", None) else None,
            # `start_time`, not `appointment_time`.
            #
            # The frontend `QueueRow` interface declares `start_time` and the
            # row renders `item.start_time`, but this endpoint returned
            # `appointment_time` — so every queue row displayed `--:--` and the
            # barber could not see when any waiting customer was booked for.
            #
            # `/calendar`, `/schedule` and `/appointments/{id}` all already
            # returned `start_time`, which is what makes this a typo rather than
            # a deliberate shape difference. Both keys are emitted now: the new
            # one so the UI works, the old one so any caller still reading it
            # keeps working.
            "start_time": start_time,
            "appointment_time": start_time,
            "status": apt.status,
            "total_amount": _money(getattr(apt, "total_estimated_price", 0) or 0),
            "notes": apt.notes or "",
            "barber_id": apt.barber_id,
            "booking_source": getattr(apt, "booking_source", "shop"),
        }

    # Optional sort override (defaults to appointment_time asc).
    #
    # `sort` was resolved with `getattr(Appointment, sort_field, None)`, which
    # accepts *any* attribute of the class, not just columns -- `?sort=metadata`
    # and `?sort=__table__` reached `MetaData.desc()` and returned 500. Reflect
    # over a fixed allowlist instead.
    if sort:
        sort_field = sort.lstrip("-")
        desc = sort.startswith("-")
        col = _SORTABLE_QUEUE_COLUMNS.get(sort_field)
        if col is not None:
            waiting_q = waiting_q.order_by(col.desc() if desc else col.asc())
            completed_q = completed_q.order_by(col.desc() if desc else col.asc())
            waiting_rows = waiting_q.offset(eff_skip).limit(eff_limit).all()
            completed_rows = completed_q.offset(eff_skip).limit(eff_limit).all()
            return {
                "waiting": [_serialize_queue_apt(r) for r in waiting_rows],
                "completed": [_serialize_queue_apt(r) for r in completed_rows],
                "waiting_total": waiting_total,
                "completed_total": completed_total,
                "total": waiting_total + completed_total,
            }

    waiting_rows = waiting_q.order_by(Appointment.appointment_time.asc()).offset(eff_skip).limit(eff_limit).all()
    completed_rows = completed_q.order_by(Appointment.appointment_time.asc()).offset(eff_skip).limit(eff_limit).all()

    return {
        "waiting": [_serialize_queue_apt(r) for r in waiting_rows],
        "completed": [_serialize_queue_apt(r) for r in completed_rows],
        "waiting_total": waiting_total,
        "completed_total": completed_total,
        "total": waiting_total + completed_total,
    }

# ── Appointment status ─────────────────────────────────────────────────────
#
# `Appointment.status` is a free-text column, so nothing stopped a caller
# writing any string into it. `POST /update-status/{id}?status=banana` returned
# 200 and stored "banana", after which the appointment disappeared from every
# queue, the schedule and the dashboard — the barber's work vanished with no
# error anywhere.
#
# Two guards now apply: the value must be a status the rest of the app knows,
# and a barber may only make the transitions their own workflow allows.

# Every status the rest of the codebase writes or filters on. Sourced from
# `scheduling_service` (pending/confirmed/waiting/in_progress/ready_for_payment),
# `booking_pos_bridge` (in-service), `appointments` (cancelled, done) and
# `member_public` (completed).
KNOWN_APPOINTMENT_STATUSES = frozenset({
    "pending",
    "confirmed",
    "waiting",
    "in-service",
    "in_progress",
    "ready_for_payment",
    "completed",
    "cancelled",
    "no_show",
    "done",
})

# Aliases the UI may send that mean the canonical value above.
STATUS_ALIASES = {
    # The barber taps "finish"; the shop moves it to the POS queue as
    # "ready_for_payment". Preserved from the original implementation.
    "completed": "ready_for_payment",
    "started": "in-service",
    "done": "completed",
    "cancel": "cancelled",
}

# What a barber may move an appointment *from*, per role in the queue.
#
# Managers are deliberately absent: they own the shop and can correct a status
# by hand, which is the escape hatch for a stuck appointment. Restricting them
# too would mean a barber could wedge an appointment that only a DBA could free.
_BARBER_TRANSITIONS: dict[str, frozenset] = {
    "pending": frozenset({"in-service", "waiting", "confirmed", "cancelled", "no_show"}),
    "confirmed": frozenset({"in-service", "waiting", "cancelled", "no_show"}),
    "waiting": frozenset({"in-service", "confirmed", "cancelled", "no_show"}),
    "in-service": frozenset({"ready_for_payment", "cancelled"}),
    "in_progress": frozenset({"ready_for_payment", "cancelled"}),
    # Terminal. `completed` here means "paid and closed" — reopening it would
    # un-count finished work and quietly inflate the dashboard's totals.
    "ready_for_payment": frozenset(),
    "completed": frozenset(),
    "done": frozenset(),
    "cancelled": frozenset(),
    "no_show": frozenset(),
}

# Roles allowed to set any known status, not just the barber workflow.
_SUPERVISOR_ROLES = frozenset({"manager", "admin", "owner"})


@router.post("/update-status/{appointment_id}")
async def update_service_status(
    appointment_id: int,
    status: str = Query(..., description="Target status"),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Move an appointment to a new status.

    ## What this accepts now

    * An unknown value is a **422**, not a 200. Writing an arbitrary string into
      a status the rest of the app filters on silently removed the appointment
      from every queue.
    * A barber may only make the transitions in `_BARBER_TRANSITIONS`; anything
      else is a **409**. Un-completing a paid appointment, for instance, would
      un-count finished work.
    * Managers keep full access within `KNOWN_APPOINTMENT_STATUSES`, because
      they are the correction path for a stuck appointment.
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    _assert_appointment_access(appointment, current_user)

    requested = (status or "").strip()
    new_status = STATUS_ALIASES.get(requested, requested)

    if new_status not in KNOWN_APPOINTMENT_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"حالة غير معروفة: '{requested}'. "
                f"المسموح: {', '.join(sorted(KNOWN_APPOINTMENT_STATUSES))}"
            ),
        )

    current = (appointment.status or "").strip()

    # A no-op is a success, not a conflict: the queue's optimistic refresh can
    # replay the transition the barber already made.
    if new_status == current:
        return {"status": "success", "new_status": current, "unchanged": True}

    is_supervisor = getattr(current_user, "role", None) in _SUPERVISOR_ROLES
    if not is_supervisor:
        allowed = _BARBER_TRANSITIONS.get(current, frozenset())
        if new_status not in allowed:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"لا يمكن الانتقال من '{current}' إلى '{new_status}'. "
                    f"المسموح: {', '.join(sorted(allowed)) or 'لا شيء'}"
                ),
            )

    # Stamp the moment work actually began, so the workstation timer can be
    # rebuilt after a refresh. Only on the first transition into service: a
    # replay or a supervisor correction must not reset the clock on a job that
    # is already under way.
    if new_status == "in-service" and current != "in-service" and appointment.started_at is None:
        # UTC, not salon local. Every other timestamp in this schema is UTC
        # (SQLite writes CURRENT_TIMESTAMP that way), and a column that disagrees
        # with its neighbours is a three-hour trap for any future query that
        # compares the two. The workstation converts to the barber's clock when
        # it renders the timer, which is the right place for that conversion.
        appointment.started_at = utc_now_naive()

    appointment.status = new_status
    db.add(appointment)
    db.commit()

    # Broadcast, so the queue updates the moment it changes rather than on the
    # next poll.
    #
    # The equivalent write in `appointments.py` and `invoices.py` broadcasts,
    # but this endpoint did not -- so the status a barber changes, which is the
    # single most common status change in the shop, was invisible to every
    # websocket listener: the cashier's board sat on a stale row and the barber's
    # own queue only moved when the 30s timer happened to fire.
    #
    # `barber_id` is included so a listener can ignore appointments belonging to
    # somebody else rather than refetching on every event in the shop.
    try:
        await manager.broadcast({
            "event": "appointment_status_changed",
            "appointment_id": appointment.id,
            "status": new_status,
            "old_status": current,
            "barber_id": appointment.barber_id,
        })
    except Exception:  # noqa: BLE001 - a failed broadcast must not fail the write
        logger.warning("status broadcast failed for appointment %s", appointment.id)

    return {"status": "success", "new_status": new_status, "previous_status": current}


@router.get("/calendar")
def get_barber_calendar(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
    month: str = None,
) -> Any:
    """
    Get barber's appointments for calendar view.
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        return {"appointments": []}

    from datetime import datetime, timedelta

    if month:
        year, month_num = map(int, month.split("-"))
        start_date = date(year, month_num, 1)
        if month_num == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month_num + 1, 1) - timedelta(days=1)
    else:
        today = salon_now().date()
        start_date = date(today.year, today.month, 1)
        if today.month == 12:
            end_date = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(today.year, today.month + 1, 1) - timedelta(days=1)

    appointments = db.query(Appointment).options(
        joinedload(Appointment.customer),
        selectinload(Appointment.services),
    ).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date >= start_date,
        Appointment.appointment_date <= end_date,
    ).order_by(Appointment.appointment_date.asc()).limit(1000).all()

    def _customer_name(apt) -> str:
        return (
            getattr(apt, "customer_name", None)
            or (apt.customer.first_name + " " + (apt.customer.last_name or "")).strip() if getattr(apt, "customer", None) else None
            or (apt.customer.name if getattr(getattr(apt, "customer", None), "name", None) else None)
            or "عميل نقدي"
        )

    def _service_name(apt) -> str:
        direct = getattr(apt, "service_name", None)
        if direct:
            return direct
        services = getattr(apt, "services", None) or []
        names = [getattr(s, "service_name_snapshot", "") for s in services if getattr(s, "service_name_snapshot", "")]
        if names:
            return ", ".join(names)
        single = getattr(apt, "service", None)
        if single is not None and getattr(single, "name", None):
            return single.name
        return "خدمة"

    return {
        "appointments": [
            {
                "id": apt.id,
                "customer_name": _customer_name(apt),
                "service_name": _service_name(apt),
                "appointment_date": str(apt.appointment_date),
                "start_time": getattr(apt, "start_time", None) or (apt.appointment_time.strftime("%H:%M") if getattr(apt, "appointment_time", None) else "09:00"),
                "status": apt.status,
                "total_amount": float(getattr(apt, "total_amount", None) or getattr(apt, "total_estimated_price", None) or 0),
                "notes": apt.notes or "",
            }
            for apt in appointments
        ]
    }


@router.get("/performance")
def get_barber_performance(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
    days: int = Query(7, ge=1, le=365, description="Window size, capped at a year"),
) -> Any:
    """Daily service count and revenue for the charts.

    ## What this used to do

    It loaded **every** completed appointment in the window with `.all()` and
    then grouped them in Python:

        appointments = db.query(Appointment).filter(...).all()   # unbounded
        for apt in appointments:                                # O(rows) in Python
            daily_data[str(apt.appointment_date)]["revenue"] += ...

    A week with 100 appointments hydrated 100 ORM objects to produce seven
    numbers, and the window itself was unbounded: `?days=100000` returned 100,000
    rows from a single request.

    It is now a single `GROUP BY` in SQL — the same shape
    `get_barber_earnings_chart` already used 500 lines below in this file — and
    `days` is capped.
    """
    # Keep the old contract for managers browsing the dashboard: they have no
    # employee id of their own, so they get an empty chart rather than a 404.
    # `_get_barber` would raise 404 here.
    barber_id = _resolve_barber_id(current_user)
    if not barber_id:
        return {"data": []}

    today = salon_now().date()
    start_date = today - timedelta(days=days - 1)

    rows = (
        db.query(
            Appointment.appointment_date.label("d"),
            func.count(Appointment.id).label("services"),
            func.coalesce(func.sum(Appointment.total_estimated_price), 0).label("revenue"),
        )
        .filter(
            Appointment.barber_id == barber_id,
            Appointment.appointment_date >= start_date,
            Appointment.appointment_date <= today,
            Appointment.status.in_(["completed", "ready_for_payment"]),
        )
        .group_by(Appointment.appointment_date)
        .all()
    )

    by_date = {
        str(r.d): {"services": int(r.services or 0), "revenue": _money(r.revenue)}
        for r in rows
    }

    # Zero-fill in Python, which is cheap: this loop is bounded by `days` and
    # touches no database.
    data = []
    for offset in range(days):
        key = str(start_date + timedelta(days=offset))
        entry = by_date.get(key)
        data.append(
            {"date": key, "services": entry["services"], "revenue": entry["revenue"]}
            if entry
            else {"date": key, "services": 0, "revenue": 0}
        )

    return {"data": data}


@router.get("/schedule")
def get_barber_schedule(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
    date: str = None,
) -> Any:
    """The barber's schedule for a given date, or today when omitted.

    ## The shadowing bug this had

    The query parameter is called `date`, which shadows the `datetime.date`
    class imported at the top of this module. The fallback branch read:

        if date:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        else:
            target_date = salon_now().date()      # <-- `date` is None here

    So the "or today" branch that the docstring promises called `.today()` on
    `None`, raising `TypeError` and returning **HTTP 500** for every caller that
    omitted the parameter — which the signature explicitly allows
    (`date: str = None`). The admin UI happens to always send a date, so the
    crash was latent rather than visible.

    `today()` is now called on the module-level alias, which the shadow cannot
    reach.
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        return {"appointments": [], "working_hours": None}

    from datetime import datetime as _dt

    if date:
        try:
            target_date = _dt.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            # A malformed date is the caller's mistake, not a server fault:
            # answer 422 rather than 500.
            raise HTTPException(
                status_code=422, detail="تاريخ غير صالح، المتوقع YYYY-MM-DD"
            )
    else:
        # `salon_now()` reads the salon's timezone, not the server's. The bare
        # `date.today()` this replaces put the whole schedule on the wrong day
        # between midnight and 03:00 Cairo time when the host is on UTC.
        target_date = salon_now().date()

    appointments = db.query(Appointment).options(
        joinedload(Appointment.customer),
        selectinload(Appointment.services),
    ).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date == target_date,
    ).order_by(Appointment.appointment_time.asc()).limit(200).all()

    # Get working hours
    from app.models.business_settings import BusinessSettings
    from app.core.working_hours import day_key, normalize_working_hours
    settings = db.query(BusinessSettings).first()
    day_name = day_key(target_date)
    working_hours = None
    if settings and settings.working_hours:
        working_hours = normalize_working_hours(settings.working_hours).get(day_name)

    return {
        "date": str(target_date),
        "day_name": day_name,
        "working_hours": working_hours,
        "appointments": [
            {
                "id": apt.id,
                "customer_name": (f"{apt.customer.first_name} {(apt.customer.last_name or '')}".strip() if apt.customer else "عميل نقدي"),
                "customer_phone": apt.customer.phone if apt.customer else "",
                "service_name": ", ".join(s.service_name_snapshot for s in (apt.services or []) if getattr(s, "service_name_snapshot", None)) or "خدمة",
                "start_time": apt.appointment_time.strftime("%H:%M") if apt.appointment_time else "09:00",
                "end_time": "",
                "status": apt.status,
                "total_amount": _money(apt.total_estimated_price),
                "notes": apt.notes or "",
                "is_walk_in": apt.booking_source == "walk_in",
            }
            for apt in appointments
        ]
    }


@router.get("/appointments/{appointment_id}")
def get_appointment_by_id(
    appointment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """
    Get appointment details by ID for the barber's workstation.
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    appointment = db.query(Appointment).options(
        joinedload(Appointment.customer),
        selectinload(Appointment.services),
    ).filter(
        Appointment.id == appointment_id,
        Appointment.barber_id == barber_id
    ).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return {
        "id": appointment.id,
        "customer_name": (f"{appointment.customer.first_name} {(appointment.customer.last_name or '')}".strip() if appointment.customer else "عميل نقدي"),
        "customer_phone": appointment.customer.phone if appointment.customer else "",
        "service_name": ", ".join(s.service_name_snapshot for s in (appointment.services or []) if getattr(s, "service_name_snapshot", None)) or "خدمة",
        "appointment_date": str(appointment.appointment_date),
        "start_time": appointment.appointment_time.strftime("%H:%M") if appointment.appointment_time else "",
        "end_time": "",
        "status": appointment.status,
        "total_amount": float(appointment.total_estimated_price or 0),
        "notes": appointment.notes or "",
        "is_walk_in": appointment.booking_source == "walk_in",
        # Previously hardcoded `None`, so the workstation's elapsed timer was
        # rebuilt as zero on every reload and a barber who refreshed mid-cut lost
        # track of the running time. Real value now, `None` only when the
        # service genuinely has not started.
        "started_at": appointment.started_at.isoformat() if appointment.started_at else None,
        "total_estimated_duration_minutes": appointment.total_estimated_duration_minutes or 0,
    }


@router.get("/clients")
def get_barber_clients(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Customers who had appointments with this barber.

    Archived customers are excluded. `Customer.is_deleted` is a shop-wide
    soft-delete, and every other customer list in the codebase filters it
    (`customers.py:52`, `dashboard.py:55`) — this one did not, so a customer the
    shop had archived stayed in the barber's client list forever, with their
    history intact, still bookable from this screen.
    """
    barber_id = _get_barber(db, current_user)

    # Was: collect every matching customer id in Python, then
    # `Customer.customer_id.in_(ids)` -- two round trips and a SQL statement whose
    # parameter list grows with the shop's whole client history. SQLite caps
    # bound parameters per statement, so a busy barber eventually hit
    # "too many SQL variables" and the endpoint failed outright. An explicit
    # join has no such ceiling and does it in one query.
    customers = (
        db.query(Customer)
        .join(Appointment, Appointment.customer_id == Customer.customer_id)
        .filter(
            Appointment.barber_id == barber_id,
            Customer.is_deleted == False,  # noqa: E712 -- SQL, not Python
        )
        .distinct()
        .all()
    )
    if sweep_expired_points(db, customers):
        db.commit()
    return [
        {
            "id": c.customer_id,
            "name": f"{c.first_name} {c.last_name}".strip(),
            "phone": c.phone or "",
            "email": c.email or "",
            "notes": c.notes or "",
            "visits": c.visits_count or 0,
            "loyalty_points": float(c.loyalty_points or 0),
        }
        for c in customers
    ]


@router.post("/clients")
def create_barber_client(
    payload: ClientPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Create a new customer record."""
    parts = (payload.name or "").strip().split(maxsplit=1)
    first_name = parts[0] if parts else payload.name or "عميل"
    last_name = parts[1] if len(parts) > 1 else ""
    customer = Customer(
        first_name=first_name,
        last_name=last_name,
        phone=payload.phone or "",
        email=payload.email,
        notes=payload.notes,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return {
        "id": customer.customer_id,
        "name": f"{customer.first_name} {customer.last_name}".strip(),
        "phone": customer.phone or "",
        "email": customer.email or "",
        "notes": customer.notes or "",
        "visits": customer.visits_count or 0,
        "loyalty_points": float(customer.loyalty_points or 0),
    }


@router.put("/clients/{client_id}")
def update_barber_client(
    client_id: int,
    payload: ClientPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Update an existing customer record.

    ## Ownership

    `Customer` is a **shop-wide** record, not a per-barber one. The previous
    guard only asked "has this barber ever had an appointment with this
    customer?" — a *read* relationship — and then let the barber **write** to the
    shared row. So any barber who had served someone once could permanently
    rewrite that customer's name, phone and email, corrupting the address book
    for every other barber and the cashier, with no audit trail.

    Editing shared identity data is therefore manager-only. A barber who needs to
    correct a customer's details gets a 403 explaining who to ask, rather than
    silently editing a record three other people depend on.

    ## Name handling

    The name used to be split with `split(maxsplit=1)` and `last_name` was set
    to `""` whenever the result had only one part — so typing a single-word name
    into the dialog **silently erased the customer's surname**. A field the
    client did not intend to change was being cleared.
    """
    customer = db.query(Customer).filter(Customer.customer_id == client_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    is_supervisor = getattr(current_user, "role", None) in _SUPERVISOR_ROLES
    if not is_supervisor:
        # Managers own the shop and may correct the shared record.
        raise HTTPException(
            status_code=403,
            detail="تعديل بيانات العميل يتم من الإدارة فقط، تواصل مع المدير لتعديل الاسم أو رقم الهاتف.",
        )

    new_name = (payload.name or "").strip()
    if new_name:
        parts = new_name.split(maxsplit=1)
        customer.first_name = parts[0]
        # Only overwrite the surname when the payload actually carries one, so a
        # single-word edit does not blank an existing surname.
        if len(parts) > 1:
            customer.last_name = parts[1]

    if payload.phone is not None:
        customer.phone = payload.phone
    if payload.email is not None:
        customer.email = payload.email
    if payload.notes is not None:
        customer.notes = payload.notes

    sweep_expired_points(db, [customer])
    db.commit()
    db.refresh(customer)
    return {
        "id": customer.customer_id,
        "name": f"{customer.first_name} {customer.last_name or ''}".strip(),
        "phone": customer.phone or "",
        "email": customer.email or "",
        "notes": customer.notes or "",
        "visits": customer.visits_count or 0,
        "loyalty_points": float(customer.loyalty_points or 0),
    }


@router.get("/working-hours")
def get_my_working_hours(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Get working hours for the logged-in barber, keyed by day name."""
    barber_id = _get_barber(db, current_user)
    hours = db.query(EmployeeWorkingHour).filter(
        EmployeeWorkingHour.employee_id == barber_id
    ).order_by(EmployeeWorkingHour.day_of_week.asc()).all()

    day_names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    result = {}
    for i, name in enumerate(day_names):
        result[name] = {"is_open": False, "open_time": "09:00", "close_time": "22:00"}
    for h in hours:
        name = day_names[h.day_of_week] if 0 <= h.day_of_week <= 6 else "saturday"
        result[name] = {
            "is_open": h.is_active,
            "open_time": h.start_time.strftime("%H:%M") if h.start_time else "09:00",
            "close_time": h.end_time.strftime("%H:%M") if h.end_time else "22:00",
        }
    return {"working_hours": result}


@router.post("/working-hours")
def save_my_working_hours(
    payload: WorkingHoursPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Replace the working hours for the logged-in barber."""
    from datetime import time as dtime
    barber_id = _get_barber(db, current_user)
    day_names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    db.query(EmployeeWorkingHour).filter(EmployeeWorkingHour.employee_id == barber_id).delete()

    days = payload.working_hours
    if isinstance(days, dict):
        days = [dict(item, **{"day_name": name}) for name, item in days.items()]

    for item in days or []:
        day_name = item.get("day_name") or item.get("day")
        day_of_week = day_names.index(day_name) if day_name in day_names else 0
        def _parse_t(v):
            try:
                return dtime.fromisoformat(str(v)[:5])
            except Exception:
                return dtime(9, 0)
        is_open = item.get("is_open", True)
        if is_open is False:
            continue
        db.add(EmployeeWorkingHour(
            employee_id=barber_id,
            day_of_week=day_of_week,
            start_time=_parse_t(item.get("open_time", item.get("start_time", "09:00"))),
            end_time=_parse_t(item.get("close_time", item.get("end_time", "22:00"))),
            is_active=True,
        ))
    db.commit()
    return {"message": "تم حفظ ساعات العمل"}


@router.get("/time-off")
def get_my_time_off(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Get time-off days for the logged-in barber."""
    barber_id = _get_barber(db, current_user)
    days = db.query(EmployeeTimeOff).filter(
        EmployeeTimeOff.employee_id == barber_id
    ).order_by(EmployeeTimeOff.off_date.desc()).all()
    return [
        {
            "id": d.id,
            "start_date": str(d.off_date),
            "end_date": str(d.off_date),
            "reason": d.reason or "",
            "type": "vacation",
        }
        for d in days
    ]


@router.post("/time-off")
def create_my_time_off(
    payload: TimeOffPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Add a time-off day for the logged-in barber."""
    from datetime import date as ddate, timedelta
    barber_id = _get_barber(db, current_user)
    try:
        off_date = ddate.fromisoformat(payload.start_date)
    except Exception:
        raise HTTPException(status_code=422, detail="تاريخ غير صالح")
    row = EmployeeTimeOff(employee_id=barber_id, off_date=off_date, reason=payload.reason)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "start_date": str(row.off_date),
        "end_date": str(row.off_date),
        "reason": row.reason or "",
        "type": payload.type or "vacation",
    }


@router.put("/time-off/{off_id}")
def update_my_time_off(
    off_id: int,
    payload: TimeOffPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Update a time-off day for the logged-in barber."""
    from datetime import date as ddate
    barber_id = _get_barber(db, current_user)
    row = db.query(EmployeeTimeOff).filter(
        EmployeeTimeOff.id == off_id,
        EmployeeTimeOff.employee_id == barber_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="الإجازة غير موجودة")
    try:
        row.off_date = ddate.fromisoformat(payload.start_date)
    except Exception:
        raise HTTPException(status_code=422, detail="تاريخ غير صالح")
    row.reason = payload.reason
    db.commit()
    return {
        "id": row.id,
        "start_date": str(row.off_date),
        "end_date": str(row.off_date),
        "reason": row.reason or "",
        "type": payload.type or "vacation",
    }


@router.delete("/time-off/{off_id}", status_code=200)
def delete_my_time_off(
    off_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Delete a time-off day for the logged-in barber."""
    barber_id = _get_barber(db, current_user)
    row = db.query(EmployeeTimeOff).filter(
        EmployeeTimeOff.id == off_id,
        EmployeeTimeOff.employee_id == barber_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="الإجازة غير موجودة")
    db.delete(row)
    db.commit()
    return {"message": "تم الحذف"}


@router.get("/earnings-summary")
def get_barber_earnings_summary(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Summary of the barber's earnings.

    ## What was wrong here

    Four separate defects, all in one function:

    1. `Decimal * float` -> **HTTP 500** as soon as the barber had any sale
       that day (verified against a live instance).
    2. `today`/`week`/`month` were cumulative-to-date sums with no upper
       bound, so they were nested supersets of one another rather than three
       distinct periods.
    3. `"pending"` was a literal copy of the `month` expression — two of the
       four cards on `/barber/earnings` always rendered the same number.
    4. `cash`/`card`/`transfer` were `* 0.7` / `* 0.2` / `* 0.1`. Invented
       figures, presented as a real payment breakdown.
    """
    barber_id = _get_barber(db, current_user)
    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    rate = _rate_decimal(barber)

    today = salon_now().date()

    def _sales(start: date, end: date) -> Decimal:
        """Sum of non-draft invoices in the closed window `[start, end)`."""
        return _dec(
            db.query(func.sum(Invoice.subtotal_amount))
            .filter(
                Invoice.barber_id == barber_id,
                Invoice.is_draft == False,  # noqa: E712 — SQL, not Python
                func.date(Invoice.created_at) >= start,
                func.date(Invoice.created_at) < end,
            )
            .scalar()
        )

    today_start, today_end = _period_bounds(today, "today")
    week_start, week_end = _period_bounds(today, "week")
    month_start, month_end = _period_bounds(today, "month")

    today_sales = _sales(today_start, today_end)
    week_sales = _sales(week_start, week_end)
    month_sales = _sales(month_start, month_end)

    # `pending` used to be a duplicate of `month`. It now means something
    # specific and checkable: commission earned this month on invoices the shop
    # has not closed yet. An invoice is closed when it has been paid out, so
    # this is the figure that is genuinely still owed.
    unclosed_sales = _dec(
        db.query(func.sum(Invoice.subtotal_amount))
        .filter(
            Invoice.barber_id == barber_id,
            Invoice.is_draft == False,  # noqa: E712
            Invoice.is_closed == False,  # noqa: E712
            func.date(Invoice.created_at) >= month_start,
            func.date(Invoice.created_at) < month_end,
        )
        .scalar()
    )

    # ── Real payment breakdown ────────────────────────────────────────────
    #
    # Grouped in SQL rather than multiplied by fixed ratios. Anything the
    # canonical vocabulary does not recognise is accumulated separately instead
    # of being silently folded into `cash`, so the buckets always add up to the
    # day's real total.
    buckets: dict[str, Decimal] = {"cash": Decimal("0"), "card": Decimal("0"), "transfer": Decimal("0")}
    unclassified = Decimal("0")
    rows = (
        db.query(Invoice.payment_method, func.sum(Invoice.subtotal_amount))
        .filter(
            Invoice.barber_id == barber_id,
            Invoice.is_draft == False,  # noqa: E712
            func.date(Invoice.created_at) >= today_start,
            func.date(Invoice.created_at) < today_end,
        )
        .group_by(Invoice.payment_method)
        .all()
    )
    for method, total in rows:
        amount = _dec(total)
        try:
            bucket = _PAYMENT_BUCKETS[normalize_payment_method(method)]
        except ValueError:
            unclassified += amount
            continue
        buckets[bucket] += amount

    return {
        "today": _money(_commission(today_sales, rate)),
        "week": _money(_commission(week_sales, rate)),
        "month": _money(_commission(month_sales, rate)),
        "pending": _money(_commission(unclosed_sales, rate)),
        "cash": _money(buckets["cash"]),
        "card": _money(buckets["card"]),
        "transfer": _money(buckets["transfer"]),
        # Surfaced rather than discarded, so a method outside the vocabulary
        # shows up as its own figure instead of vanishing from the total.
        "other": _money(unclassified),
        "total_sales": _money(month_sales),
        "commission_rate": f"{rate * 100:.0f}%",
    }


@router.get("/commissions")
def get_barber_commissions(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
    period: str = "week",
    limit: int = Query(200, ge=1, le=500),
) -> Any:
    """Commission list for the barber over a period."""
    barber_id = _get_barber(db, current_user)
    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    rate = _rate_decimal(barber)

    # Same closed-window helper as `earnings-summary`, so a commission row can
    # never sum to more than the figure the summary reports for the same period.
    start, end = _period_bounds(salon_now().date(), period)

    invoices = db.query(Invoice).options(
        selectinload(Invoice.items),
        joinedload(Invoice.customer),
    ).filter(
        Invoice.barber_id == barber_id,
        func.date(Invoice.created_at) >= start,
        func.date(Invoice.created_at) < end,
        Invoice.is_draft == False,  # noqa: E712
    ).order_by(Invoice.created_at.desc()).limit(limit).all()

    items = []
    for inv in invoices:
        item_names = []
        for it in (inv.items or []):
            name = getattr(it, "service_name", None)
            if name:
                item_names.append(name)
        customer = getattr(inv, "customer", None)
        customer_name = (
            f"{customer.first_name} {(customer.last_name or '')}".strip()
            if customer is not None else "عميل نقدي"
        )
        items.append({
            "id": inv.id,
            "invoice_no": inv.invoice_no or f"#{inv.id}",
            "date": str(inv.created_at.date()) if inv.created_at else str(start),
            "amount": _money(inv.subtotal_amount),
            # Decimal throughout, so this row's commission can be summed
            # against the summary's figure without a rounding drift.
            "commission": _money(_commission(inv.subtotal_amount, rate)),
            "customer_name": customer_name,
            "service_name": ", ".join(item_names[:2]) or "خدمة",
            "paid": bool(inv.is_closed),
        })
    return items


@router.get("/earnings-chart")
def get_barber_earnings_chart(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
    period: str = "week",
) -> Any:
    """Daily revenue for charts (plain array)."""
    barber_id = _get_barber(db, current_user)
    days = 7 if period == "week" else 30 if period == "month" else 365
    start = salon_now().date() - timedelta(days=days - 1)

    rows = db.query(
        func.date(Invoice.created_at).label("d"),
        func.sum(Invoice.subtotal_amount).label("s"),
    ).filter(
        Invoice.barber_id == barber_id,
        func.date(Invoice.created_at) >= start,
        Invoice.is_draft == False,
    ).group_by(func.date(Invoice.created_at)).all()
    by_day = {str(r[0]): float(r[1] or 0) for r in rows}

    data = []
    for i in range(days):
        day = start + timedelta(days=i)
        data.append({"date": str(day), "revenue": by_day.get(str(day), 0)})
    return data


@router.put("/notification-settings")
def save_notification_settings(
    payload: NotificationSettingsPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Save notification preferences for the barber.

    ## What was broken

    `NotificationSettingsPayload` declared a required `notifications: dict`, but
    the client PUTs the object **flat**:

        api.put("/barber/notification-settings", notifications)
        // -> {"new_appointment": false, "appointment_reminder": false, ...}

    Pydantic rejected it with `422 Field required`, so the barber could not
    save a single notification setting, ever. Verified live against a running
    instance.

    ## What is stored

    Both the granular switches (in the new `notification_preferences` JSON
    column) and the master flag, which is now *derived*: the shop may only
    notify a barber if at least one event channel is on. Writing a master flag
    independently is how the two drifted apart.
    """
    from app.models.preference import Preference

    # Accept either shape: a flat object of switches, or the documented
    # `{"notifications": {...}}` envelope. Both are in the wild — the flat one
    # is what the current client sends.
    raw = dict(payload.notifications or {})
    if not raw:
        # A flat body leaves `notifications` empty and lands in `model_extra`,
        # so the switches are read from there instead.
        raw = payload.flat

    pref = db.query(Preference).filter(Preference.user_id == current_user.id).first()
    if not pref:
        pref = Preference(user_id=current_user.id)
        db.add(pref)

    merged = _DEFAULT_NOTIFICATIONS.copy()
    merged.update({k: bool(v) for k, v in raw.items() if k in merged})

    pref.notification_preferences = merged
    # Derived, not stored independently: one master flag that must agree with
    # the channels underneath it.
    pref.notifications_enabled = any(merged.values())

    db.commit()
    return {
        "message": "تم حفظ الإعدادات",
        "notifications": merged,
        "enabled": pref.notifications_enabled,
    }


@router.post("/appointments/{appointment_id}/tip")
def add_appointment_tip(
    appointment_id: int,
    payload: TipPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.require_barber_or_manager),
) -> Any:
    """Record a tip for an appointment (recorded in the appointment notes)."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الموعد غير موجود")
    _assert_appointment_access(appointment, current_user)
    amount = max(0.0, float(payload.amount or 0))
    tip_line = f"بقشيش: {amount} ({salon_now().date().isoformat()})"
    appointment.notes = (appointment.notes or "") + "\n" + tip_line if appointment.notes else tip_line
    db.commit()
    return {"message": "تم تسجيل البقشيش", "tip": amount}
