from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, time
from decimal import Decimal
from typing import List, Optional

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner, require_owner_or_manager
from app.models.user import User
from app.models.pos_shift import PosShift
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.expense import Expense
from app.models.business_settings import BusinessSettings

router = APIRouter(prefix="/pos-shifts", tags=["POS Shifts"])

def _is_within_working_hours(db: Session) -> bool:
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return True # Default to open if no settings
    
    now = datetime.now()
    day_name = now.strftime("%A").lower()
    day_config = settings.working_hours.get(day_name)
    
    # Check if the day is marked as open
    if not day_config or not day_config.get("is_open"):
        return False
        
    start_str = day_config.get("open_time")
    end_str = day_config.get("close_time")
    
    if not start_str or not end_str:
        return True
        
    try:
        # Time strings are typically "HH:MM"
        start_time = datetime.strptime(start_str, "%H:%M").time()
        end_time = datetime.strptime(end_str, "%H:%M").time()
        current_time = now.time()
        
        # Handle overnight shifts (e.g., 22:00 to 02:00)
        if start_time <= end_time:
            return start_time <= current_time <= end_time
        else: # Crosses midnight
            return current_time >= start_time or current_time <= end_time
    except Exception:
        return True

@router.get("/current")
def get_current_shift(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    shift = db.query(PosShift).options(joinedload(PosShift.user)).filter(
        PosShift.user_id == current_user.id,
        PosShift.status == "open"
    ).first()
    return shift

@router.post("/open")
def open_shift(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    # Check working hours
    if not _is_within_working_hours(db):
        # We allow it but maybe a warning is better? 
        # User requested it to be "connected" with working hours.
        # Let's be strict but allow an override if requested in the future.
        raise HTTPException(
            status_code=400, 
            detail="لا يمكن فتح الوردية خارج ساعات عمل المحل الرسمية"
        )

    existing = db.query(PosShift).filter(
        PosShift.user_id == current_user.id,
        PosShift.status == "open"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="لديك وردية مفتوحة بالفعل")
    
    shift = PosShift(
        user_id=current_user.id,
        opening_cash=Decimal(str(payload.get("opening_cash") or payload.get("openingCash") or 0)),
        opening_note=payload.get("opening_note"),
        status="open"
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift

@router.post("/{shift_id}/close")
def close_shift(
    shift_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    shift = db.query(PosShift).filter(PosShift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="الوردية غير موجودة")
    
    if shift.status == "closed":
        raise HTTPException(status_code=400, detail="الوردية مغلقة بالفعل")

    # Aggregate Data
    invoices = db.query(Invoice).filter(
        Invoice.created_at >= shift.opened_at,
        Invoice.created_by_user_id == shift.user_id
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
    ).all()
    total_expenses = sum(Decimal(str(e.amount)) for e in expenses)
    
    shift.status = "closed"
    shift.closed_at = datetime.now()
    shift.actual_closing_cash = Decimal(str(payload.get("countedCash") or payload.get("closing_cash") or 0))
    shift.expected_closing_cash = shift.opening_cash + cash_sales # Only cash affects the drawer
    shift.total_sales = total_sales
    shift.invoice_count = len(invoices)
    shift.discount_total = discount_total
    shift.closing_note = payload.get("closing_note")
    
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

@router.get("/daily-summary")
def get_daily_summary(
    date_str: Optional[str] = None, # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    if date_str:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        target_date = datetime.now().date()
        
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
        Invoice.created_at <= end_of_day
    ).all()
    
    return {
        "date": target_date,
        "shifts": shifts,
        "expenses": expenses,
        "summary": {
            "total_sales": sum(inv.total_amount for inv in invoices),
            "invoice_count": len(invoices),
            "total_expenses": sum(Decimal(str(e.amount)) for e in expenses),
            "shift_count": len(shifts)
        }
    }

@router.get("")
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    return db.query(PosShift).options(joinedload(PosShift.user)).filter(PosShift.user_id == current_user.id).order_by(PosShift.id.desc()).all()
