from pathlib import Path
from uuid import uuid4
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner, require_owner_or_manager
from app.models.user import User
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseSummary, ExpenseArchiveResponse
from app.utils.expense_labels import expense_label_ar
from app.utils.media import process_image_content, get_upload_path
from app.core.upload_security import validate_image_or_pdf
from app.crud.core_business import create_cash_transaction

router = APIRouter(prefix="/expenses", tags=["Expenses"])
# UPLOAD_DIR now resolved lazily via get_upload_path("expenses") (SOT §5.2)


@router.get("", response_model=list[ExpenseRead])
def list_expenses(
    response: Response = None,
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
    sort: Optional[str] = Query(None, description="Sort field. '-' prefix for DESC"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(Expense).options(joinedload(Expense.created_by_user))

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

    # Phase 2: optional explicit sort (defaults to expense_date DESC)
    if sort:
        sort_field = sort.lstrip("-")
        desc = sort.startswith("-")
        column = getattr(Expense, sort_field, None)
        if column is not None:
            query = query.order_by(column.desc() if desc else column.asc())
    else:
        query = query.order_by(Expense.expense_date.desc(), Expense.id.desc())

    # Pagination: page overrides skip if provided
    eff_skip = skip
    eff_limit = limit
    if page is not None:
        eff_skip = (page - 1) * eff_limit

    # Phase 2: count + headers for client-side pagination UIs
    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)
    return query.offset(eff_skip).limit(eff_limit).all()


@router.get("/archive", response_model=ExpenseArchiveResponse)
def get_expenses_archive(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    response: Response = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(Expense).options(joinedload(Expense.created_by_user))

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

    # Phase 2: also expose X-Total-Count header for consistency
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(limit)
        response.headers["X-Page"] = str(page)

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

    categories = [
        {
            "name": r.category,
            "label_ar": expense_label_ar(r.category),
            "value": float(r.total),
        }
        for r in cat_rows
    ]
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
        "top_category_ar": expense_label_ar(top_category) if top_category else None,
        "top_amount": top_amount,
        "status_breakdown": status_breakdown,
    }


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    # recipient_name إجباري للإيجار/المشتريات
    requiring = {"إيجار", "مشتريات"}
    if payload.category in requiring and not (payload.recipient_name and str(payload.recipient_name).strip()):
        raise HTTPException(status_code=400, detail="اسم المستفيد/المورد مطلوب لفئة الإيجار والمشتريات")
    status_val = getattr(payload, "status", None) or ("pending_audit" if str(current_user.role).lower() == "cashier" else "approved")
    expense = Expense(
        title=payload.title or f"مصروف {payload.category}",
        amount=payload.amount,
        category=payload.category,
        description=payload.description or "",
        recipient_name=payload.recipient_name,
        payment_method=payload.payment_method or "cash",
        expense_date=payload.expense_date or datetime.now(),
        invoice_image_url=getattr(payload, "invoice_image_url", None),
        reference_type=getattr(payload, "reference_type", None),
        reference_id=getattr(payload, "reference_id", None),
        internal_notes=getattr(payload, "internal_notes", None),
        status=status_val,
        created_by_user_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    # reload with creator for response
    expense = db.query(Expense).options(joinedload(Expense.created_by_user)).filter(Expense.id == expense.id).first()

    # ديناميكي: أي مصروف معتمد يسجل حركة خزنة تلقائياً (كاش/غير كاش)
    if status_val == "approved" and expense.amount and float(expense.amount) > 0:
        try:
            pm = str(expense.payment_method or "cash").strip().lower()
            create_cash_transaction(
                db,
                direction="out",
                amount=float(expense.amount),
                transaction_type="expense_payment",
                payment_method=pm or "cash",
                notes=f"مصروف: {expense.title} - {expense.category}",
                user_id=current_user.id,
                reference_type="expense",
                reference_id=expense.id,
                reference_no=f"EXP-{expense.id}",
                commit=True,
            )
        except Exception as _e:
            print(f"[Cashbox] expense auto-withdraw failed for expense {expense.id}: {_e}")

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
    
    was_pending = expense.status == "pending_audit"
    expense.status = "approved"
    db.commit()
    db.refresh(expense)

    # إذا كان معلق سابقاً، الآن يسمع في الخزنة
    if was_pending and expense.amount and float(expense.amount) > 0:
        try:
            from app.crud.core_business import find_existing_cash_transaction
            existing = find_existing_cash_transaction(db, reference_type="expense", reference_id=expense.id, transaction_type="expense_payment")
            if not existing:
                pm = str(expense.payment_method or "cash").strip().lower()
                create_cash_transaction(
                    db,
                    direction="out",
                    amount=float(expense.amount),
                    transaction_type="expense_payment",
                    payment_method=pm or "cash",
                    notes=f"مصروف معتمد: {expense.title} - {expense.category}",
                    user_id=current_user.id,
                    reference_type="expense",
                    reference_id=expense.id,
                    reference_no=f"EXP-{expense.id}",
                    commit=True,
                )
        except Exception as _e:
            print(f"[Cashbox] approve auto-withdraw failed for expense {expense.id}: {_e}")

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
    """رفع فاتورة مصروف (صورة أو PDF)."""
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image_or_pdf(file, max_size=10 * 1024 * 1024)
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    safe_name = f"{uuid4().hex}.{ext}"
    upload_dir = get_upload_path("expenses")
    upload_dir.mkdir(parents=True, exist_ok=True)
    save_path = upload_dir / safe_name
    save_path.write_bytes(content)
    return {"url": f"/uploads/expenses/{safe_name}"}


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

    # recipient_name إجباري للإيجار/المشتريات عند التعديل
    requiring = {"إيجار", "مشتريات"}
    if payload.category in requiring and not (payload.recipient_name and str(payload.recipient_name).strip()):
        raise HTTPException(status_code=400, detail="اسم المستفيد/المورد مطلوب لفئة الإيجار والمشتريات")

    expense.title = payload.title or expense.title
    expense.amount = payload.amount
    expense.category = payload.category
    expense.description = payload.description if payload.description is not None else expense.description
    expense.recipient_name = payload.recipient_name
    expense.payment_method = payload.payment_method or expense.payment_method
    expense.invoice_image_url = getattr(payload, "invoice_image_url", None) or expense.invoice_image_url
    expense.reference_type = getattr(payload, "reference_type", None)
    expense.reference_id = getattr(payload, "reference_id", None)
    expense.internal_notes = getattr(payload, "internal_notes", None)
    if payload.expense_date:
        expense.expense_date = payload.expense_date
    if getattr(payload, "status", None):
        expense.status = payload.status

    db.commit()
    db.refresh(expense)
    # ensure created_by is loaded for response
    db.refresh(expense)
    # reload with joinedload for creator
    expense = db.query(Expense).options(joinedload(Expense.created_by_user)).filter(Expense.id == expense_id).first()
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
