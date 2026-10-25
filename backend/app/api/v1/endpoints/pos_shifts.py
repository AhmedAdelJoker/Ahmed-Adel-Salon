from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, time, timedelta
from decimal import Decimal
from typing import List, Optional

from app.db.session import get_db
from app.api.deps import (
    require_cashier_manager_owner,
    require_owner_or_manager,
    require_shift_operator,
)
from app.models.user import User
from app.models.pos_shift import PosShift
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.business_settings import BusinessSettings
from app.schemas.pos_shift import (
    DailySummaryResponse,
    DailySummaryShiftRead,
    DailySummaryTotals,
    DailySummaryUserRead,
)
from app.services.pos_shift_service import (
    auto_close_expired_shifts,
    is_within_working_hours,
    next_closing_moment,
    shift_window_totals,
)
from app.services.activity_log_service import log_activity
from app.services.runtime_settings_service import get_runtime_settings
from app.core.clock import coerce_naive, salon_now
from app.core.security import verify_password

router = APIRouter(prefix="/pos-shifts", tags=["POS Shifts"])

@router.post("/auto-close-expired")
def auto_close_expired_shifts_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    """Trigger global auto-close check for all shifts."""
    count = auto_close_expired_shifts(db)
    return {"status": "ok", "closed_shifts": count}

@router.get("/current")
def get_current_shift(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shift_operator)
):
    # Proactively check and close all expired shifts
    auto_close_expired_shifts(db)

    shift = db.query(PosShift).options(joinedload(PosShift.user)).filter(
        PosShift.user_id == current_user.id,
        PosShift.status == "open"
    ).first()
    return shift

@router.get("/current/stats")
def get_current_shift_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shift_operator),
):
    """Live, money-grade figures for the operator's open shift.

    Mirrors the exact aggregation used by `close_shift` (1s lower-bound
    tolerance, drafts excluded, same expense status filter) so the "expected
    cash" the cashier sees while closing matches the figure the server stamps
    one second later. `ShiftSidebar` used to derive this client-side from
    `total_sales` (which includes card + split) and never subtracted expenses,
    so the العجز/الزيادة indicator was wrong whenever card sales existed.
    """
    auto_close_expired_shifts(db)

    shift = (
        db.query(PosShift)
        .filter(PosShift.user_id == current_user.id, PosShift.status == "open")
        .first()
    )
    if shift is None:
        return {"shift_id": None, "stats": None}

    opened_at = coerce_naive(shift.opened_at)
    closing_at = salon_now()

    totals = shift_window_totals(
        db,
        user_id=shift.user_id,
        start=opened_at,
        end=closing_at,
        opening_cash=shift.opening_cash,
    )

    rules = get_runtime_settings(
        "financial_rules",
        {"shiftCloseWarningMinutes": 15, "maxCashDiscrepancyWithoutNote": 0},
    )
    try:
        warning_minutes = max(
            0.0, float(rules.get("shiftCloseWarningMinutes", 15) or 0)
        )
    except (TypeError, ValueError):
        warning_minutes = 15.0

    # The variance the close will be refused for, sent to the client so the
    # cashier can be asked for the note and the manager's co-signature in the
    # same dialog, instead of discovering the gate after a rejected attempt.
    try:
        discrepancy_limit = max(
            0.0, float(rules.get("maxCashDiscrepancyWithoutNote", 0) or 0)
        )
    except (TypeError, ValueError):
        discrepancy_limit = 0.0

    next_close = next_closing_moment(db)
    closing_in_minutes = None
    if next_close is not None:
        closing_in_minutes = max(0.0, (next_close - closing_at).total_seconds() / 60.0)

    return {
        "shift_id": shift.id,
        "opened_at": shift.opened_at,
        "stats": {
            "total_sales": float(totals["total_sales"]),
            "cash_sales": float(totals["cash_sales"]),
            "card_sales": float(totals["card_sales"]),
            "split_sales": float(totals["split_sales"]),
            "discount_total": float(totals["discount_total"]),
            "invoice_count": totals["invoice_count"],
            "service_count": totals["service_count"],
            "product_count": totals["product_count"],
            "total_expenses": float(totals["total_expenses"]),
            "cash_expenses": float(totals["cash_expenses"]),
            "expected_closing_cash": float(totals["expected_closing_cash"]),
            "closing_in_minutes": closing_in_minutes,
            "warning_minutes": warning_minutes,
            "discrepancy_limit": discrepancy_limit,
        },
    }


SHIFT_OVERRIDE_ROLES = ("owner", "admin", "manager", "accountant")


@router.post("/open")
def open_shift(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shift_operator)
):
    within_hours = is_within_working_hours(db)
    override = bool(payload.get("override_hours") or payload.get("overrideHours"))
    override_reason = str(
        payload.get("override_reason") or payload.get("overrideReason") or ""
    ).strip()

    if not within_hours:
        if not override:
            raise HTTPException(
                status_code=400,
                detail="لا يمكن فتح الوردية خارج ساعات عمل المحل الرسمية",
            )
        if str(current_user.role or "").lower() not in SHIFT_OVERRIDE_ROLES:
            raise HTTPException(
                status_code=403,
                detail="فتح الوردية خارج الدوام متاح للمدير والمالك فقط",
            )
        if not override_reason:
            raise HTTPException(
                status_code=400,
                detail="اذكر سبب فتح الوردية خارج ساعات العمل",
            )

    existing = db.query(PosShift).filter(
        PosShift.user_id == current_user.id,
        PosShift.status == "open"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="لديك وردية مفتوحة بالفعل")

    opening_note = payload.get("opening_note")
    if not within_hours and override:
        opening_note = (
            f"{opening_note or ''} | تجاوز خارج الدوام: {override_reason}"
        ).strip(" |")

    shift = PosShift(
        user_id=current_user.id,
        opening_cash=Decimal(str(payload.get("opening_cash") or payload.get("openingCash") or 0)),
        opening_note=opening_note,
        status="open"
    )
    db.add(shift)
    db.flush()

    from app.crud.core_business import create_cash_transaction
    oc = float(shift.opening_cash or 0)
    if oc > 0:
        create_cash_transaction(
            db,
            direction="in",
            amount=oc,
            transaction_type="opening_balance",
            payment_method="cash",
            notes=f"رصيد افتتاحي وردية #{shift.id} - {current_user.full_name or current_user.username}",
            user_id=current_user.id,
            reference_type="pos_shift",
            reference_id=shift.id,
            reference_no=f"SHIFT-{shift.id}",
            commit=False,
        )

    if not within_hours and override:
        log_activity(
            db,
            user_id=current_user.id,
            action="OPEN_SHIFT_OUTSIDE_HOURS",
            entity_type="PosShift",
            entity_id=str(shift.id),
            description=(
                f"فتح وردية خارج ساعات العمل بواسطة "
                f"{current_user.full_name or current_user.username} — السبب: {override_reason}"
            ),
            commit=False,
        )

    db.commit()
    db.refresh(shift)
    return shift

@router.post("/{shift_id}/close")
def close_shift(
    shift_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shift_operator)
):
    shift = db.query(PosShift).filter(PosShift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="الوردية غير موجودة")
    if current_user.role == "cashier" and shift.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="يمكنك إغلاق ورديتك فقط")

    if shift.status == "closed":
        raise HTTPException(status_code=400, detail="الوردية مغلقة بالفعل")

    # Aggregate Data
    # The window carries a 1s tolerance at both ends. SQLite stores server-side
    # CURRENT_TIMESTAMP without microseconds while bound datetimes carry
    # ".000000", so same-second invoices would string-compare as older
    # than opened_at and silently drop out of the close aggregates.
    # The upper bound matters just as much: without it an invoice raised while
    # this request was in flight gets folded into a shift that closed before it
    # existed, and the day's cash no longer reconciles.
    #
    # The arithmetic itself lives in `shift_window_totals`, shared with the
    # live tiles, the archived reprint and the auto-closer, so the figure the
    # cashier counted against is the figure the server stamps.
    closing_at = salon_now()
    opened_at = coerce_naive(shift.opened_at) or closing_at
    totals = shift_window_totals(
        db,
        user_id=shift.user_id,
        start=opened_at,
        end=closing_at,
        opening_cash=shift.opening_cash,
    )
    total_sales = totals["total_sales"]
    cash_sales = totals["cash_sales"]
    discount_total = totals["discount_total"]
    invoice_count = totals["invoice_count"]
    service_count = totals["service_count"]
    product_count = totals["product_count"]

    actual_closing_cash = Decimal(str(payload.get("countedCash") or payload.get("closing_cash") or 0))
    expected_closing_cash = totals["expected_closing_cash"]

    # Owner-configured cash discrepancy policy (financial_rules.maxCashDiscrepancyWithoutNote):
    # beyond this variance the close must carry an explanatory note, and a
    # cashier needs a manager to co-sign it. 0 keeps the pre-gate behaviour.
    managed_roles = {"manager", "owner", "admin"}
    discrepancy_limit = Decimal(
        str(
            get_runtime_settings(
                "financial_rules",
                {"maxCashDiscrepancyWithoutNote": 0},
            ).get("maxCashDiscrepancyWithoutNote", 0)
            or 0
        )
    )
    variance = actual_closing_cash - expected_closing_cash
    if discrepancy_limit > 0 and abs(variance) > discrepancy_limit:
        closing_note = str(payload.get("closing_note") or payload.get("closingNote") or "").strip()
        if not closing_note:
            raise HTTPException(
                status_code=400,
                detail="العجز/الزيادة تجاوزت الحد المسموح — اذكر السبب في ملاحظة الإغلاق",
            )
        if str(current_user.role or "").lower() not in managed_roles:
            approver_username = str(payload.get("approver_username") or payload.get("approverUsername") or "").strip()
            approver_password = str(payload.get("approver_password") or payload.get("approverPassword") or "")
            approver = (
                db.query(User).filter(User.username == approver_username).first()
                if approver_username
                else None
            )
            approved = (
                approver is not None
                and str(approver.role or "").lower() in managed_roles
                and bool(approver_password)
                and verify_password(approver_password, approver.hashed_password)
            )
            if not approved:
                raise HTTPException(
                    status_code=403,
                    detail="إغلاق بفارق تجاوز الحد المسموح يتطلب اعتماد مدير بصلاحياته",
                )
            log_activity(
                db,
                user_id=current_user.id,
                action="START_POS_SHIFT_CLOSE_DISCREPANCY",
                entity_type="PosShift",
                entity_id=str(shift_id),
                description=(
                    "إغلاق وردية بفارق تجاوز الحد، تم اعتماده بواسطة "
                    f"{approver.username} (فارق {variance})"
                ),
                commit=False,
            )

    # Close atomically. Two cashiers on two terminals can both read
    # status == "open" and both compute totals; a conditional UPDATE means the
    # database picks one winner and the loser is told, instead of the second
    # write overwriting the first one's figures.
    claimed = (
        db.query(PosShift)
        .filter(PosShift.id == shift_id, PosShift.status == "open")
        .update(
            {
                PosShift.status: "closed",
                PosShift.closed_at: closing_at,
                PosShift.actual_closing_cash: actual_closing_cash,
                PosShift.expected_closing_cash: expected_closing_cash,
                PosShift.total_sales: total_sales,
                PosShift.invoice_count: invoice_count,
                PosShift.discount_total: discount_total,
                PosShift.closing_note: payload.get("closing_note"),
            },
            synchronize_session=False,
        )
    )
    if not claimed:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="تم إغلاق الوردية من جهاز آخر — حدّث الصفحة قبل الإغلاق مرة أخرى",
        )

    db.commit()
    db.refresh(shift)
    
    # Return enriched data
    return {
        "shift": shift,
        "stats": {
            "cash_sales": cash_sales,
            "card_sales": totals["card_sales"],
            "split_sales": totals["split_sales"],
            "service_count": service_count,
            "product_count": product_count,
            "total_expenses": totals["total_expenses"],
            "cashier_name": current_user.full_name or current_user.username
        }
    }

@router.get("/{shift_id}/stats")
def get_shift_stats(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shift_operator),
):
    """Money-grade breakdown for a (usually closed) shift — the reprint source.

    Same aggregation as `close_shift` run over the shift's stored window, so a
    reprint weeks later reconciles with the figures stamped at close time.
    """
    shift = db.query(PosShift).filter(PosShift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="الوردية غير موجودة")
    if current_user.role == "cashier" and shift.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="يمكنك رؤية ورديتك فقط")

    opened_at = coerce_naive(shift.opened_at)
    if opened_at is None:
        raise HTTPException(status_code=400, detail="الوردية بلا وقت افتتاح")

    closed_at = coerce_naive(shift.closed_at)
    end = closed_at if shift.status == "closed" and closed_at else salon_now()

    totals = shift_window_totals(
        db,
        user_id=shift.user_id,
        start=opened_at,
        end=end,
        opening_cash=shift.opening_cash,
    )

    return {
        "shift_id": shift.id,
        "stats": {
            "total_sales": float(totals["total_sales"]),
            "cash_sales": float(totals["cash_sales"]),
            "card_sales": float(totals["card_sales"]),
            "split_sales": float(totals["split_sales"]),
            "discount_total": float(totals["discount_total"]),
            "invoice_count": totals["invoice_count"],
            "service_count": totals["service_count"],
            "product_count": totals["product_count"],
            "total_expenses": float(totals["total_expenses"]),
            "cash_expenses": float(totals["cash_expenses"]),
            "opening_cash": float(shift.opening_cash or 0),
            "expected_closing_cash": float(totals["expected_closing_cash"]),
            "actual_closing_cash": float(shift.actual_closing_cash or 0)
            if shift.status == "closed"
            else None,
        },
    }


@router.get("/daily-summary", response_model=DailySummaryResponse)
def get_daily_summary(
    date_str: Optional[str] = None, # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD")
    else:
        target_date = salon_now().date()
        
    start_of_day = datetime.combine(target_date, time.min)
    end_of_day = datetime.combine(target_date, time.max)
    
    shifts = db.query(PosShift).options(joinedload(PosShift.user)).filter(
        PosShift.opened_at >= start_of_day,
        PosShift.opened_at <= end_of_day
    ).all()
    
    expenses = db.query(Expense).filter(
        Expense.created_at >= start_of_day,
        Expense.created_at <= end_of_day
    ).all()
    
    invoices = db.query(Invoice).filter(
        Invoice.created_at >= start_of_day,
        Invoice.created_at <= end_of_day,
        Invoice.is_draft == False,
    ).all()

    shift_items = []
    for shift in shifts:
        if shift.status == "open":
            # Live sales for open shifts (stored totals are only set on close).
            # The window and the arithmetic are the shared ones, so the figure
            # the daily summary prints is the figure the close will stamp.
            # The upper bound is the end of the reported day, like every other
            # query in this endpoint.
            totals = shift_window_totals(
                db,
                user_id=shift.user_id,
                start=coerce_naive(shift.opened_at) or start_of_day,
                end=end_of_day,
            )
            sales = totals["total_sales"]
            count = totals["invoice_count"]
        else:
            sales = shift.total_sales or Decimal("0")
            count = shift.invoice_count or 0
        shift_items.append(
            DailySummaryShiftRead(
                id=shift.id,
                status=shift.status,
                opened_at=shift.opened_at,
                closed_at=shift.closed_at,
                total_sales=sales,
                invoice_count=count,
                user=DailySummaryUserRead(
                    full_name=shift.user.full_name if shift.user else None,
                    username=shift.user.username if shift.user else None,
                ),
            )
        )
    
    return DailySummaryResponse(
        date=target_date,
        shifts=shift_items,
        expenses=expenses,
        summary=DailySummaryTotals(
            total_sales=sum((inv.total_amount for inv in invoices), Decimal("0")),
            invoice_count=len(invoices),
            total_expenses=sum((Decimal(str(e.amount)) for e in expenses), Decimal("0")),
            shift_count=len(shifts),
        ),
    )

@router.get("")
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    query = db.query(PosShift).options(joinedload(PosShift.user))
    # Supervisory roles audit/reprint any shift; a cashier sees their own only.
    if str(current_user.role or "").lower() not in {"owner", "manager", "admin", "accountant"}:
        query = query.filter(PosShift.user_id == current_user.id)
    return query.order_by(PosShift.id.desc()).all()


@router.get("/total-balance")
def get_total_cash_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    """Returns the total expected cash balance in the shop drawer (opening + sales)."""
    # Sum up all currently open shifts
    open_shifts = db.query(PosShift).filter(PosShift.status == "open").all()
    
    total_opening = Decimal("0.00")
    if open_shifts:
        total_opening = sum(Decimal(str(s.opening_cash)) for s in open_shifts)
    
    # Calculate sales for these shifts (drafts excluded; the shared window and
    # arithmetic, so the drawer figure agrees with the shift that is counted)
    total_sales = Decimal("0.00")
    for s in open_shifts:
        totals = shift_window_totals(
            db,
            user_id=s.user_id,
            start=coerce_naive(s.opened_at) or salon_now(),
            end=salon_now(),
        )
        # Only cash sales affect the physical drawer
        total_sales += totals["cash_sales"]

    # Return as float to ensure JSON compatibility
    return {"total_balance": float(total_opening + total_sales)}
