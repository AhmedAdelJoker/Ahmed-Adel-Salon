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
from app.models.invoice_item import InvoiceItem
from app.models.expense import Expense
from app.models.business_settings import BusinessSettings
from app.schemas.pos_shift import (
    DailySummaryResponse,
    DailySummaryShiftRead,
    DailySummaryTotals,
    DailySummaryUserRead,
)
from app.services.pos_shift_service import auto_close_expired_shifts, is_within_working_hours
from app.services.activity_log_service import log_activity
from app.core.clock import salon_now

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
    # NOTE: 1s tolerance on the lower bound. SQLite stores server-side
    # CURRENT_TIMESTAMP without microseconds while bound datetimes carry
    # ".000000", so same-second invoices would string-compare as older
    # than opened_at and silently drop out of the close aggregates.
    # The upper bound matters just as much: without it an invoice raised while
    # this request was in flight gets folded into a shift that closed before it
    # existed, and the day's cash no longer reconciles.
    closing_at = salon_now()
    shift_start = shift.opened_at - timedelta(seconds=1)
    shift_end = closing_at + timedelta(seconds=1)
    invoices = db.query(Invoice).filter(
        Invoice.created_at >= shift_start,
        Invoice.created_at <= shift_end,
        Invoice.created_by_user_id == shift.user_id,
        Invoice.is_draft == False,
    ).all()
    
    total_sales = Decimal("0.00")
    cash_sales = Decimal("0.00")
    card_sales = Decimal("0.00")
    split_sales = Decimal("0.00")
    discount_total = Decimal("0.00")
    
    invoice_ids = [inv.id for inv in invoices]
    service_count = 0
    product_count = 0
    
    if invoice_ids:
        items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id.in_(invoice_ids)).all()
        for item in items:
            if item.service_id:
                service_count += (item.quantity or 1)
            elif item.product_id:
                product_count += (item.quantity or 1)

    for inv in invoices:
        total_sales += inv.total_amount
        discount_total += (inv.discount_amount or 0)
        pm = (inv.payment_method or "").upper()
        if pm == "CASH":
            cash_sales += inv.total_amount
        elif pm == "CARD":
            card_sales += inv.total_amount
        else:
            split_sales += inv.total_amount

    # Expenses in this shift
    expenses = db.query(Expense).filter(
        Expense.created_at >= shift.opened_at,
        Expense.created_at <= shift_end,
        Expense.created_by_user_id == shift.user_id,
        Expense.status.in_(["approved", "recorded"]),
    ).all()
    total_expenses = sum(Decimal(str(e.amount)) for e in expenses)
    cash_expenses = sum(
        Decimal(str(e.amount))
        for e in expenses
        if str(e.payment_method or "cash").lower() == "cash"
    )
    
    actual_closing_cash = Decimal(str(payload.get("countedCash") or payload.get("closing_cash") or 0))
    expected_closing_cash = shift.opening_cash + cash_sales - cash_expenses

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
                PosShift.invoice_count: len(invoices),
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
            "card_sales": card_sales,
            "split_sales": split_sales,
            "service_count": service_count,
            "product_count": product_count,
            "total_expenses": total_expenses,
            "cashier_name": current_user.full_name or current_user.username
        }
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
            # Same linkage as close_shift: invoices by this user since opening.
            # NOTE: 1s tolerance for the sqlite datetime-precision trap
            # (see total-balance): opened_at keeps microseconds while
            # created_at is truncated to the second on read-back.
            live_invoices = db.query(Invoice).filter(
                Invoice.created_at >= shift.opened_at - timedelta(seconds=1),
                Invoice.created_by_user_id == shift.user_id,
                Invoice.is_draft == False,
            ).all()
            sales = sum((inv.total_amount for inv in live_invoices), Decimal("0"))
            count = len(live_invoices)
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
    return db.query(PosShift).options(joinedload(PosShift.user)).filter(PosShift.user_id == current_user.id).order_by(PosShift.id.desc()).all()


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
    
    # Calculate sales for these shifts (drafts excluded; 1s tolerance
    # for the sqlite datetime-precision trap, see close_shift)
    total_sales = Decimal("0.00")
    for s in open_shifts:
        shift_start = s.opened_at - timedelta(seconds=1)
        invoices = db.query(Invoice).filter(
            Invoice.created_at >= shift_start,
            Invoice.created_by_user_id == s.user_id,
            Invoice.is_draft == False,
        ).all()
        # Only cash sales affect the physical drawer
        cash_sales = sum(Decimal(str(inv.total_amount)) for inv in invoices if (inv.payment_method or "").upper() == "CASH")
        total_sales += cash_sales

    # Return as float to ensure JSON compatibility
    return {"total_balance": float(total_opening + total_sales)}
