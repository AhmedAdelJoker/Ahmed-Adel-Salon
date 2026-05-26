from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner
from app.models.user import User
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseRead

router = APIRouter(prefix="/expenses", tags=["Expenses"])
UPLOAD_DIR = Path(__file__).resolve().parents[5] / "uploads" / "expenses"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("", response_model=list[ExpenseRead])
def list_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    return db.query(Expense).order_by(Expense.id.desc()).all()


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    expense = Expense(
        amount=payload.amount,
        category=payload.category,
        description=payload.description,
        recipient_name=payload.recipient_name,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.post("/upload-invoice")
async def upload_invoice_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_cashier_manager_owner),
):
    suffix = Path(file.filename or "invoice").suffix or ".jpg"
    filename = f"{uuid4().hex}{suffix}"
    target = UPLOAD_DIR / filename
    content = await file.read()
    target.write_bytes(content)
    return {"url": f"/uploads/expenses/{filename}"}


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="المصروف غير موجود")

    db.delete(expense)
    db.commit()
    return None
