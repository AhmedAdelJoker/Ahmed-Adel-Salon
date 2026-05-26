from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta, date

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner, get_current_active_shift
from app.models.user import User
from app.models.expense import Expense
from app.models.pos_shift import PosShift
from app.schemas.expense import (
    ExpenseCreate, ExpenseRead, ExpenseUpdate, 
    ExpenseSummary, ExpenseArchiveResponse
)

from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
import os
import shutil
from pathlib import Path

router = APIRouter(prefix="/expenses", tags=["Expenses"])

@router.post("/upload-invoice")
def upload_expense_invoice(
    file: UploadFile = File(...),
    current_user: User = Depends(require_cashier_manager_owner)
):
    # Ensure uploads directory exists
    upload_dir = Path("uploads/expenses")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"inv_{timestamp}_{file.filename}"
    file_path = upload_dir / filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/uploads/expenses/{filename}"}

@router.get("")
def list_expenses(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = Query(default=None),
    current_user: User = Depends(require_cashier_manager_owner)
):
    query = db.query(Expense)
    if q:
        query = query.filter(or_(
            Expense.title.ilike(f"%{q}%"),
            Expense.description.ilike(f"%{q}%"),
            Expense.category.ilike(f"%{q}%")
        ))
    total = query.count()
    items = query.order_by(Expense.expense_date.desc()).offset(skip).limit(limit).all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}

@router.get("/summary", response_model=ExpenseSummary)
def get_expense_summary(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_cashier_manager_owner)
):
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)

    def get_stats(start_date):
        stats = db.query(
            func.sum(Expense.amount).label("total"),
            func.count(Expense.id).label("count")
        ).filter(Expense.expense_date >= start_date, Expense.status != "cancelled").first()
        return stats.total or 0, stats.count or 0

    today_total, today_count = get_stats(today_start)
    week_total, week_count = get_stats(week_start)
    month_total, month_count = get_stats(month_start)

    top_cat_query = db.query(
        Expense.category,
        func.sum(Expense.amount).label("total")
    ).filter(Expense.expense_date >= month_start, Expense.status != "cancelled")\
     .group_by(Expense.category).order_by(func.sum(Expense.amount).desc()).first()
    
    top_category = top_cat_query.category if top_cat_query else None
    latest_expense = db.query(Expense).order_by(Expense.created_at.desc()).first()

    return {
        "today_total": today_total,
        "week_total": week_total,
        "month_total": month_total,
        "today_count": today_count,
        "week_count": week_count,
        "month_count": month_count,
        "top_category": top_category,
        "latest_expense": latest_expense
    }

@router.get("/archive", response_model=ExpenseArchiveResponse)
def get_expense_archive(
    db: Session = Depends(get_db),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    category: Optional[str] = Query(default=None),
    payment_method: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_cashier_manager_owner)
):
    query = db.query(Expense)
    
    if start_date:
        query = query.filter(Expense.expense_date >= start_date)
    if end_date:
        query = query.filter(Expense.expense_date <= end_date)
    if category:
        query = query.filter(Expense.category == category)
    if payment_method:
        query = query.filter(Expense.payment_method == payment_method)
    if status:
        query = query.filter(Expense.status == status)
    if q:
        query = query.filter(or_(
            Expense.title.ilike(f"%{q}%"),
            Expense.description.ilike(f"%{q}%")
        ))

    total = query.count()
    total_amount = db.query(func.sum(Expense.amount)).filter(query.whereclause).scalar() or 0
    
    items = query.order_by(Expense.expense_date.desc()).offset(skip).limit(limit).all()

    return {
        "items": items,
        "total": total,
        "total_amount": total_amount,
        "skip": skip,
        "limit": limit
    }


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
    # ERP Rule: Optionally link to shift if available, but don't strictly require for all (e.g. rent)
):
    # Try to get active shift but don't fail if not found (optional for generic expenses)
    shift = db.query(PosShift).filter(
        PosShift.cashier_user_id == current_user.id,
        PosShift.status == "open"
    ).order_by(PosShift.opened_at.desc()).first()
    
    expense = Expense(
        **payload.model_dump(),
        created_by_user_id=getattr(current_user, "id", None),
        shift_id=shift.id if shift else None,
        expense_date=payload.expense_date or datetime.now()
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense

@router.get("/{expense_id}", response_model=ExpenseRead)
def get_expense(
    expense_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_cashier_manager_owner)
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense

@router.put("/{expense_id}", response_model=ExpenseRead)
def update_expense(
    expense_id: int, 
    payload: ExpenseUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_cashier_manager_owner)
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)
    
    db.commit()
    db.refresh(expense)
    return expense

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # ERP Rule: Cannot delete expenses from a closed shift (Safety Check)
    if expense.shift_id:
        shift = db.query(PosShift).filter(PosShift.id == expense.shift_id).first()
        if shift and shift.status != "open":
            raise HTTPException(
                status_code=403, 
                detail="لا يمكن حذف مصاريف وردية مغلقة (قفل أمني)"
            )

    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted successfully"}



