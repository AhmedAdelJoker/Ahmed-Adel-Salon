from datetime import datetime
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api import deps
from app.schemas.core_business import CashTransactionCreate, CashTransactionOut
from app.crud.core_business import (
    get_cash_balance,
    list_cash_transactions,
    create_cash_transaction,
    create_audit_log,
)
from app.models.cash_transaction import CashTransaction
from app.models.business_settings import BusinessSettings
from app.models.user import User
from app.services.pdf_service import generate_cash_receipt_pdf

router = APIRouter(prefix="/cashbox", tags=["cashbox"])


@router.get("/balance")
def cashbox_balance(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner)
):
    return {"balance": get_cash_balance(db)}


@router.get("/transactions", response_model=list[CashTransactionOut])
def cashbox_transactions(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    is_voided: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    page: Optional[int] = Query(None, ge=1),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner)
):
    from sqlalchemy import or_
    query = db.query(CashTransaction)

    # Date range
    if from_date:
        try:
            start = datetime.strptime(from_date, "%Y-%m-%d")
            query = query.filter(CashTransaction.transaction_date >= start)
        except ValueError:
            try:
                start = datetime.fromisoformat(from_date)
                query = query.filter(CashTransaction.transaction_date >= start)
            except Exception:
                pass
    if to_date:
        try:
            end = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(CashTransaction.transaction_date <= end)
        except ValueError:
            try:
                end = datetime.fromisoformat(to_date)
                query = query.filter(CashTransaction.transaction_date <= end)
            except Exception:
                pass

    # Search
    term = q or search
    if term:
        like = f"%{term}%"
        query = query.filter(
            or_(
                CashTransaction.transaction_no.ilike(like),
                CashTransaction.reference_no.ilike(like),
                CashTransaction.type.ilike(like),
                CashTransaction.notes.ilike(like),
                CashTransaction.payment_method.ilike(like),
            )
        )

    if direction and direction != "all":
        query = query.filter(CashTransaction.direction == direction)

    if type and type != "all":
        query = query.filter(CashTransaction.type == type)

    if payment_method and payment_method != "all":
        query = query.filter(CashTransaction.payment_method == payment_method)

    if is_voided is not None:
        query = query.filter(CashTransaction.is_voided == (1 if is_voided else 0))

    query = query.order_by(CashTransaction.transaction_date.desc(), CashTransaction.id.desc())

    # Pagination: page overrides offset
    if page is not None:
        offset = (page - 1) * limit

    return query.offset(offset).limit(limit).all()


@router.get("/transactions/{transaction_id}/pdf")
def get_transaction_receipt_pdf(
    transaction_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner)
):
    transaction = db.query(CashTransaction).filter(CashTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="الحركة غير موجودة")
    
    settings = db.query(BusinessSettings).first()
    
    pdf_path = generate_cash_receipt_pdf(
        transaction,
        settings=settings
    )
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"receipt_TX_{transaction_id}.pdf"
    )


@router.post("/transactions", response_model=CashTransactionOut)
def create_manual_cash_transaction(
    payload: CashTransactionCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner)
):
    try:
        transaction_type = "manual_deposit" if payload.direction == "in" else "manual_withdraw"

        row = create_cash_transaction(
            db,
            direction=payload.direction,
            amount=payload.amount,
            transaction_type=transaction_type,
            payment_method=payload.payment_method or "cash",
            notes=payload.notes,
            user_id=current_user.id
        )

        create_audit_log(
            db,
            action="CASH_TRANSACTION_CREATED",
            entity_name="cash_transactions",
            entity_id=row.id,
            user_id=current_user.id,
            new_values={
                "id": row.id,
                "direction": row.direction,
                "amount": row.amount,
                "type": row.type,
            },
        )

        return row

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))



