from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.schemas.core_business import CashTransactionCreate, CashTransactionOut
from app.crud.core_business import (
    get_cash_balance,
    list_cash_transactions,
    create_cash_transaction,
    create_audit_log,
)
from app.models.cash_transaction import CashTransaction
from app.models.business_settings import BusinessSettings
from app.services.pdf_service import generate_cash_receipt_pdf

router = APIRouter(prefix="/cashbox", tags=["cashbox"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/balance")
def cashbox_balance(db: Session = Depends(get_db)):
    return {"balance": get_cash_balance(db)}


@router.get("/transactions", response_model=list[CashTransactionOut])
def cashbox_transactions(limit: int = 50, db: Session = Depends(get_db)):
    return list_cash_transactions(db, limit=limit)


@router.get("/transactions/{transaction_id}/pdf")
def get_transaction_receipt_pdf(
    transaction_id: int,
    db: Session = Depends(get_db),
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
    db: Session = Depends(get_db),
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
        )

        create_audit_log(
            db,
            action="CASH_TRANSACTION_CREATED",
            entity_name="cash_transactions",
            entity_id=row.id,
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



