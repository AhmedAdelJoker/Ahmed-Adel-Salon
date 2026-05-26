from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import require_cashier_manager_owner, require_owner_or_manager
from app.db.session import get_db
from app.models.invoice import Invoice
from app.models.pos_shift import PosShift
from app.models.user import User
from app.schemas.pos_shift import PosShiftClose, PosShiftOpen
from app.services.activity_service import log_activity

router = APIRouter(prefix="/pos-shifts", tags=["POS Shifts"])


class PosShiftReview(BaseModel):
    manager_review_note: str


def _serialize_shift(db: Session, shift: PosShift):
    invoices = db.query(Invoice).filter(Invoice.shift_id == shift.id).all()
    
    totals = {
        "cash": Decimal("0.00"),
        "vodafone_cash": Decimal("0.00"),
        "instapay": Decimal("0.00"),
        "bank_card": Decimal("0.00"),
    }
    total_commissions_dec = Decimal("0.00")
    for invoice in invoices:
        method = str(invoice.payment_method or "cash").lower()
        if method in totals:
            totals[method] += Decimal(str(invoice.total_amount or 0))
        
        for item in (invoice.items or []):
            total_commissions_dec += Decimal(str(item.commission_amount or 0))

    from app.models.expense import Expense
    # Fallback to time-based if shift_id is not yet populated
    expenses = db.query(Expense).filter(
        (Expense.shift_id == shift.id) | 
        ((Expense.shift_id == None) & (Expense.created_at >= shift.opened_at))
    ).all()
    
    # Use stored values if shift is closed, otherwise use calculated
    if shift.status in ["closed", "under_review"] and shift.total_sales is not None:
        total_sales = float(shift.total_sales)
        total_expenses = float(shift.total_expenses or 0)
        total_commissions = float(shift.total_commissions or 0)
        net_cash = float(shift.net_cash or 0)
        expected_cash = float(shift.expected_cash or 0)
    else:
        total_sales = sum(float(invoice.total_amount or 0) for invoice in invoices)
        total_expenses = sum(float(e.amount or 0) for e in expenses)
        total_commissions = float(total_commissions_dec)
        net_cash = float(totals["cash"]) - sum(float(e.amount or 0) for e in expenses if "كاش" in (e.reason or "").lower())
        expected_cash = float(shift.opening_cash or 0) + net_cash

    return {
        "id": shift.id,
        "cashier_user_id": shift.cashier_user_id,
        "opened_by_user_id": shift.opened_by_user_id,
        "opening_cash": float(shift.opening_cash or 0),
        "expected_cash": expected_cash,
        "counted_cash": float(shift.counted_cash or 0) if shift.counted_cash is not None else None,
        "cash_difference": float(shift.cash_difference or 0) if shift.cash_difference is not None else None,
        "status": shift.status,
        
        # Financial Report Fields
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "total_commissions": total_commissions,
        "net_cash": net_cash,
        
        # Payment Breakdown (for UI)
        "cash_total": float(totals["cash"]),
        "vodafone_cash_total": float(totals["vodafone_cash"]),
        "instapay_total": float(totals["instapay"]),
        "bank_card_total": float(totals["bank_card"]),
        
        "opened_at": shift.opened_at,
        "closed_at": shift.closed_at,
        "closed_by_user_id": shift.closed_by_user_id,
        "manager_reviewed_by_user_id": shift.manager_reviewed_by_user_id,
        "manager_review_note": shift.manager_review_note,
        "created_at": shift.created_at,
        "invoice_count": len(invoices),
        "cashier_name": shift.cashier_user.full_name if shift.cashier_user else "كاشير",
        
        # New Snapshots
        "service_sales_snapshot": float(shift.service_sales_snapshot or 0),
        "product_sales_snapshot": float(shift.product_sales_snapshot or 0),
        "commissions_snapshot": float(shift.commissions_snapshot or 0),
        "tips_snapshot": float(shift.tips_snapshot or 0),
        "expenses_snapshot": float(shift.expenses_snapshot or 0),
        "discrepancy_note": shift.discrepancy_note,
        "denominations_json": shift.denominations_json,
    }


def _latest_open_shift(db: Session, user_id: int) -> PosShift | None:
    return (
        db.query(PosShift)
        .filter(PosShift.cashier_user_id == user_id, PosShift.status == "open")
        .order_by(PosShift.id.desc())
        .first()
    )


@router.get("")
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(PosShift).order_by(PosShift.id.desc())
    if current_user.role == "cashier":
        query = query.filter(PosShift.cashier_user_id == current_user.id)
    return [_serialize_shift(db, shift) for shift in query.all()]


@router.get("/current")
def current_shift(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    shift = _latest_open_shift(db, current_user.id)
    if not shift:
        return None
    return _serialize_shift(db, shift)


@router.post("/open", status_code=status.HTTP_201_CREATED)
def open_shift(
    payload: PosShiftOpen,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    existing = _latest_open_shift(db, current_user.id)
    if existing:
        raise HTTPException(status_code=400, detail="There is already an open shift for this cashier")

    shift = PosShift(
        cashier_user_id=current_user.id,
        opened_by_user_id=current_user.id,
        opening_cash=payload.opening_cash,
        expected_cash=payload.opening_cash,
        opened_at=datetime.utcnow(),
        status="open",
    )
    db.add(shift)
    log_activity(
        db,
        user_id=current_user.id,
        action="shift_opened",
        entity_type="pos_shift",
        entity_id=None,
        description=f"POS shift opened with opening cash {payload.opening_cash}",
    )
    db.commit()
    db.refresh(shift)
    return _serialize_shift(db, shift)


@router.post("/{shift_id}/close")
def close_shift(
    shift_id: int,
    payload: PosShiftClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    shift = db.query(PosShift).filter(PosShift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    if current_user.role == "cashier" and shift.cashier_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only close your own shift")
    if shift.status != "open":
        raise HTTPException(status_code=400, detail="Shift is already closed")

    invoices = db.query(Invoice).filter(Invoice.shift_id == shift.id).all()
    total_sales = Decimal("0.00")
    total_service_sales = Decimal("0.00")
    total_product_sales = Decimal("0.00")
    total_commissions = Decimal("0.00")
    total_tips = Decimal("0.00")
    cash_total = Decimal("0.00")
    
    for invoice in invoices:
        total_sales += Decimal(str(invoice.total_amount or 0))
        total_tips += Decimal(str(getattr(invoice, "tip_amount", 0) or 0))
        
        if str(invoice.payment_method or "cash").lower() == "cash":
            cash_total += Decimal(str(invoice.total_amount or 0))
        
        for item in (invoice.items or []):
            total_commissions += Decimal(str(item.commission_amount or 0))
            if item.item_type == "service":
                total_service_sales += Decimal(str(item.total_price or 0))
            elif item.item_type == "product":
                total_product_sales += Decimal(str(item.total_price or 0))

    from app.models.expense import Expense
    expenses = db.query(Expense).filter(
        (Expense.shift_id == shift.id) |
        ((Expense.shift_id == None) & (Expense.created_at >= shift.opened_at))
    ).all()
    
    total_expenses = sum(Decimal(str(e.amount or 0)) for e in expenses)
    cash_expenses = sum(Decimal(str(e.amount or 0)) for e in expenses if "كاش" in (e.reason or "").lower())

    expected_cash = Decimal(str(shift.opening_cash or 0)) + cash_total - cash_expenses
    counted_cash = Decimal(str(payload.counted_cash or 0))
    cash_difference = counted_cash - expected_cash

    # Snapshots
    shift.service_sales_snapshot = total_service_sales
    shift.product_sales_snapshot = total_product_sales
    shift.commissions_snapshot = total_commissions
    shift.tips_snapshot = total_tips
    shift.expenses_snapshot = total_expenses
    
    shift.denominations_json = payload.denominations_json
    shift.discrepancy_note = payload.discrepancy_note

    shift.total_sales = total_sales
    shift.total_commissions = total_commissions
    shift.total_expenses = total_expenses
    shift.net_cash = cash_total - cash_expenses
    shift.expected_cash = expected_cash
    shift.counted_cash = counted_cash
    shift.cash_difference = cash_difference
    
    # If difference is found, note is mandatory (Validation in frontend, but here we set status)
    shift.status = "under_review" if cash_difference != 0 else "closed"
    shift.closed_at = datetime.utcnow()
    shift.closed_by_user_id = current_user.id
    if payload.manager_review_note:
        shift.manager_review_note = payload.manager_review_note

    db.add(shift)
    log_activity(
        db,
        user_id=current_user.id,
        action="shift_closed",
        entity_type="pos_shift",
        entity_id=shift.id,
        description=f"Shift closed with expected cash {expected_cash} and counted cash {counted_cash}",
    )
    db.commit()
    db.refresh(shift)
    return _serialize_shift(db, shift)


@router.post("/{shift_id}/review")
def review_shift(
    shift_id: int,
    payload: PosShiftReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    shift = db.query(PosShift).filter(PosShift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    shift.manager_reviewed_by_user_id = current_user.id
    shift.manager_review_note = payload.manager_review_note
    if shift.status == "under_review":
        shift.status = "closed"
        
    db.add(shift)
    log_activity(
        db,
        user_id=current_user.id,
        action="shift_reviewed",
        entity_type="pos_shift",
        entity_id=shift.id,
        description=f"Shift {shift.id} reviewed by {current_user.username}",
    )
    db.commit()
    db.refresh(shift)
    return _serialize_shift(db, shift)



