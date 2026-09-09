from pathlib import Path
from uuid import uuid4
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner, require_owner_or_manager
from app.models.user import User
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseSummary, ExpenseArchiveResponse
from app.utils.media import process_image_content, get_upload_path

router = APIRouter(prefix="/expenses", tags=["Expenses"])
UPLOAD_DIR = get_upload_path("expenses")


@router.get("", response_model=list[ExpenseRead])
def list_expenses(
    q: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=200),
    skip: int = Query(0, ge=0),
    page: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(Expense)

    # Unified search (q or search)
    term = q or search
    if term:
        like = f"%{term}%"
        query = query.filter(
            (Expense.title.ilike(like)) | (Expense.description.ilike(like)) | (Expense.category.ilike(like))
        )

    if category and category != "all":
        query = query.filter(Expense.category == category)

    if payment_method and payment_method != "all":
        query = query.filter(Expense.payment_method == payment_method)

    if status and status != "all":
        query = query.filter(Expense.status == status)

    # Date filters: accept both naming conventions
    df = date_from or start_date
    dt = date_to or end_date
    if df:
        try:
            start = datetime.strptime(df, "%Y-%m-%d")
            query = query.filter(Expense.expense_date >= start)
        except ValueError:
            try:
                start = datetime.fromisoformat(df)
                query = query.filter(Expense.expense_date >= start)
            except Exception:
                pass
    if dt:
        try:
            end = datetime.strptime(dt, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(Expense.expense_date <= end)
        except ValueError:
            try:
                end = datetime.fromisoformat(dt)
                query = query.filter(Expense.expense_date <= end)
            except Exception:
                pass

    query = query.order_by(Expense.expense_date.desc(), Expense.id.desc())

    # Pagination: page overrides skip if provided
    if page is not None:
        skip = (page - 1) * limit

    return query.offset(skip).limit(limit).all()


@router.get("/archive", response_model=ExpenseArchiveResponse)
def get_expenses_archive(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(Expense)

    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Expense.expense_date >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59
            )
            query = query.filter(Expense.expense_date <= end)
        except ValueError:
            pass

    if category and category != "all":
        query = query.filter(Expense.category == category)

    if payment_method and payment_method != "all":
        query = query.filter(Expense.payment_method == payment_method)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Expense.title.ilike(search_term)) | (Expense.description.ilike(search_term))
        )

    total = query.count()
    total_amount = query.with_entities(func.sum(Expense.amount)).scalar() or 0

    items = (
        query.order_by(Expense.expense_date.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "total_amount": float(total_amount),
    }


@router.get("/summary", response_model=dict)
def get_expenses_summary(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    from datetime import date, time
    base_query = db.query(Expense)

    if from_date:
        try:
            start = datetime.strptime(from_date, "%Y-%m-%d")
            base_query = base_query.filter(Expense.expense_date >= start)
        except ValueError:
            pass
    if to_date:
        try:
            end = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            base_query = base_query.filter(Expense.expense_date <= end)
        except ValueError:
            pass

    total = base_query.with_entities(func.sum(Expense.amount)).scalar() or 0
    count = base_query.count()

    # Today
    today_start = datetime.combine(date.today(), time.min)
    today_end = datetime.combine(date.today(), time.max)
    today_total = db.query(func.sum(Expense.amount)).filter(
        Expense.expense_date >= today_start, Expense.expense_date <= today_end
    ).scalar() or 0

    # This month
    month_start = datetime(date.today().year, date.today().month, 1)
    month_total = db.query(func.sum(Expense.amount)).filter(
        Expense.expense_date >= month_start
    ).scalar() or 0

    # Year total
    year_start = datetime(date.today().year, 1, 1)
    year_total = db.query(func.sum(Expense.amount)).filter(
        Expense.expense_date >= year_start
    ).scalar() or 0

    # Category breakdown & top
    cat_rows = base_query.with_entities(
        Expense.category,
        func.sum(Expense.amount).label("total"),
        func.count(Expense.id).label("cnt")
    ).group_by(Expense.category).order_by(func.sum(Expense.amount).desc()).all()

    categories = [{"name": r.category, "value": float(r.total)} for r in cat_rows]
    top_category = cat_rows[0].category if cat_rows else None
    top_amount = float(cat_rows[0].total) if cat_rows else 0

    # Status breakdown
    status_rows = db.query(Expense.status, func.sum(Expense.amount), func.count(Expense.id)).group_by(Expense.status).all()
    status_breakdown = {r[0]: {"amount": float(r[1]), "count": r[2]} for r in status_rows}

    return {
        "total_amount": float(total),
        "count": count,
        "categories": categories,
        # Legacy aliases for existing frontend
        "today_total": float(today_total),
        "month_total": float(month_total),
        "year_total": float(year_total),
        "top_category": top_category,
        "top_amount": top_amount,
        "status_breakdown": status_breakdown,
    }


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    expense = Expense(
        title=payload.title or f"مصروف {payload.category}",
        amount=payload.amount,
        category=payload.category,
        description=payload.description or "",
        recipient_name=payload.recipient_name,
        payment_method=payload.payment_method or "cash",
        expense_date=payload.expense_date or datetime.now(),
        invoice_image_url=getattr(payload, "invoice_image_url", None),
        status=getattr(payload, "status", None) or ("pending_audit" if str(current_user.role).lower() == "cashier" else "approved"),
        created_by_user_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.post("/{expense_id}/approve", response_model=ExpenseRead)
def approve_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    expense.status = "approved"
    db.commit()
    db.refresh(expense)
    return expense


@router.post("/{expense_id}/reject", response_model=ExpenseRead)
def reject_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    expense.status = "rejected"
    db.commit()
    db.refresh(expense)
    return expense


@router.post("/upload-invoice")
async def upload_invoice_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_cashier_manager_owner),
):
    content = await file.read()
    filename = process_image_content(content, file.filename, UPLOAD_DIR)
    return {"url": f"/uploads/expenses/{filename}"}


@router.put("/{expense_id}", response_model=ExpenseRead)
def update_expense(
    expense_id: int,
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="المصروف غير موجود")
    
    if str(current_user.role or "").strip().lower() not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="التعديل متاح للمالك فقط")

    expense.title = payload.title or expense.title
    expense.amount = payload.amount
    expense.category = payload.category
    expense.description = payload.description if payload.description is not None else expense.description
    expense.recipient_name = payload.recipient_name
    expense.payment_method = payload.payment_method or expense.payment_method
    expense.invoice_image_url = getattr(payload, "invoice_image_url", None) or expense.invoice_image_url
    if payload.expense_date:
        expense.expense_date = payload.expense_date
    if getattr(payload, "status", None):
        expense.status = payload.status

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # User requested to disable deleting financial records
    raise HTTPException(
        status_code=403, 
        detail="حذف السجلات المالية غير مسموح به لضمان نزاهة البيانات"
    )
    
    # expense = db.query(Expense).filter(Expense.id == expense_id).first()
    # if not expense:
    #     raise HTTPException(status_code=404, detail="المصروف غير موجود")
    # db.delete(expense)
    # db.commit()
    # return None
