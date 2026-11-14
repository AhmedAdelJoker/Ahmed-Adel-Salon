from pathlib import Path
from uuid import uuid4
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Query, Request, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner, require_owner_or_admin, require_owner_or_manager
from app.models.user import User
from app.models.expense import Expense
from app.models.cash_transaction import CashTransaction
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseSummary, ExpenseArchiveResponse
from app.utils.expense_labels import expense_label_ar
from app.utils.media import process_image_content, get_upload_path
from app.core.upload_security import validate_image_or_pdf
from app.core.audit import audit_log
from app.crud.core_business import create_cash_transaction, find_existing_cash_transaction
from app.core.clock import (
    salon_day_bounds_utc,
    salon_month_start_utc as _salon_month_start_utc,
    salon_now,
    salon_year_start_utc as _salon_year_start_utc,
    utc_now_naive,
)

router = APIRouter(prefix="/expenses", tags=["Expenses"])
# UPLOAD_DIR now resolved lazily via get_upload_path("expenses") (SOT §5.2)

# Sort fields the ledger may order by. Anything else is a 400 instead of a
# 500 from getattr()ing something that isn't a column (e.g. "metadata").
_SORTABLE_FIELDS = {
    "id": Expense.id,
    "title": Expense.title,
    "amount": Expense.amount,
    "category": Expense.category,
    "status": Expense.status,
    "payment_method": Expense.payment_method,
    "expense_date": Expense.expense_date,
    "created_at": Expense.created_at,
}


def _is_owner_or_admin(user) -> bool:
    return str(getattr(user, "role", "") or "").strip().lower() in {"owner", "admin"}


def _serialize_expense(exp, *, reveal_private: bool) -> ExpenseRead:
    """Serialize an Expense ORM object, stripping the owner-only fields.

    `internal_notes` is the owner's private memo attached to a financial
    record; cashiers/accountants/managers must never receive it. Done at the
    serialization boundary so the ORM object itself is never mutated (setting
    `exp.internal_notes = None` would mark the instance dirty and persist the
    NULL on the next flush — silently destroying the note).
    """
    model = ExpenseRead.model_validate(exp)
    if not reveal_private:
        model = model.model_copy(update={"internal_notes": None})
    return model


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

    # Phase 2: optional explicit sort (defaults to expense_date DESC).
    # Allowlist only — an arbitrary attribute name used to 500 the request.
    if sort:
        sort_field = sort.lstrip("-").lower()
        desc = sort.startswith("-")
        column = _SORTABLE_FIELDS.get(sort_field)
        if column is None:
            raise HTTPException(
                status_code=400,
                detail=f"فرز غير مدعوم: {sort_field} — المسموح: {sorted(_SORTABLE_FIELDS)}",
            )
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
    items = query.offset(eff_skip).limit(eff_limit).all()
    reveal_private = _is_owner_or_admin(current_user)
    return [_serialize_expense(e, reveal_private=reveal_private) for e in items]


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

    # The archive is the money ledger, not the journal of decisions —
    # rejected rows never moved money, so they stay out of counts and sums.
    # (They remain visible in the main tab under the status filter.)
    query = query.filter(Expense.status != "rejected")

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

    reveal_private = _is_owner_or_admin(current_user)
    return {
        "items": [_serialize_expense(e, reveal_private=reveal_private) for e in items],
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

    # Money that actually moved is "approved" only. Pending is reported
    # separately (it may still become money out); rejected never was.
    approved_query = base_query.filter(Expense.status == "approved")
    pending_query = base_query.filter(Expense.status == "pending_audit")

    total = approved_query.with_entities(func.sum(Expense.amount)).scalar() or 0
    count = approved_query.count()
    pending_total = pending_query.with_entities(func.sum(Expense.amount)).scalar() or 0
    pending_count = pending_query.count()

    # One reading of the clock for the whole summary. Called per line instead,
    # the month could be computed from one "now" and the year from another if the
    # request happened to land on midnight.
    _today = salon_now().date()

    # `Expense.expense_date` is a DATETIME column carrying SQLite's
    # CURRENT_TIMESTAMP, so it holds UTC -- despite the name, it is not a calendar
    # date. Every bound below is therefore built in UTC. The day, month and year
    # are still the *shop's*, so the first-of-month and first-of-year instants
    # have to be anchored to the shop's midnight and then converted; anchoring them
    # to UTC midnight would slide the month boundary by three hours and move a
    # whole day of expenses across it.
    today_start, today_end = salon_day_bounds_utc(_today)
    month_start = _salon_month_start_utc(_today)
    year_start = _salon_year_start_utc(_today)

    # Today
    today_total = db.query(func.sum(Expense.amount)).filter(
        Expense.expense_date >= today_start, Expense.expense_date <= today_end,
        Expense.status == "approved",
    ).scalar() or 0

    # This month
    month_total = db.query(func.sum(Expense.amount)).filter(
        Expense.expense_date >= month_start,
        Expense.status == "approved",
    ).scalar() or 0

    # Year total
    year_total = db.query(func.sum(Expense.amount)).filter(
        Expense.expense_date >= year_start,
        Expense.status == "approved",
    ).scalar() or 0

    # Category breakdown & top — approved money only, same basis as totals
    cat_rows = approved_query.with_entities(
        Expense.category,
        func.sum(Expense.amount).label("total"),
        func.count(Expense.id).label("cnt")
    ).group_by(Expense.category).order_by(func.sum(Expense.amount).desc()).all()

    # Payment-method breakdown — the frontend used to compute this from the
    # current page of rows, which made the chart depend on which page you
    # were looking at. Server-side, filtered by the same from/to range.
    pay_rows = approved_query.with_entities(
        Expense.payment_method,
        func.sum(Expense.amount).label("total"),
        func.count(Expense.id).label("cnt"),
    ).group_by(Expense.payment_method)
    payment_breakdown = [
        {
            "method": r.payment_method or "cash",
            "amount": float(r.total),
            "count": r.cnt,
        }
        for r in pay_rows
    ]

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
        "payment_breakdown": payment_breakdown,
        "pending_total": float(pending_total),
        "pending_count": pending_count,
        # Legacy aliases for existing frontend
        "today_total": float(today_total),
        "month_total": float(month_total),
        "year_total": float(year_total),
        "top_category": top_category,
        "top_category_ar": expense_label_ar(top_category) if top_category else None,
        "top_amount": top_amount,
        "status_breakdown": status_breakdown,
    }


@router.get("/trend", response_model=dict)
def get_expenses_trend(
    months: int = Query(12, ge=3, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Monthly approved-spend series for the trend chart.

    Dialect-agnostic on purpose: one ranged SUM per month bucket instead of
    strftime/to_char. The buckets are zero-filled so the chart axis is stable.
    """
    _today = salon_now().date()
    buckets: list[tuple[int, int]] = []
    for offset in range(months - 1, -1, -1):
        month = _today.month - offset
        year = _today.year
        while month <= 0:
            month += 12
            year -= 1
        buckets.append((year, month))

    series = []
    for year, month in buckets:
        start = datetime(year, month, 1)
        end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
        approved = db.query(Expense).filter(
            Expense.expense_date >= start,
            Expense.expense_date < end,
            Expense.status == "approved",
        )
        total = approved.with_entities(func.sum(Expense.amount)).scalar() or 0
        count = approved.count()
        series.append({
            "month": f"{year}-{month:02d}",
            "total": float(total),
            "count": int(count),
        })
    return {"months": series}


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
    role = str(current_user.role or "").strip().lower()
    status_val = "approved" if role in {"owner", "admin"} else "pending_audit"
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
    db.flush()

    if status_val == "approved" and expense.amount and float(expense.amount) > 0:
        pm = str(expense.payment_method or "cash").strip().lower()
        try:
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
                commit=False,
            )
        except ValueError as e:
            # The cash box refused (e.g. overdraft when negative cash is
            # disallowed). The expense must not persist without its cash
            # movement — fail the whole request atomically.
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    expense = db.query(Expense).options(joinedload(Expense.created_by_user)).filter(Expense.id == expense.id).first()
    return _serialize_expense(expense, reveal_private=_is_owner_or_admin(current_user))


@router.post("/{expense_id}/approve", response_model=ExpenseRead)
def approve_expense(
    expense_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_admin),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    was_pending = expense.status == "pending_audit"
    if expense.status not in {"pending_audit", "approved"}:
        raise HTTPException(status_code=400, detail="لا يمكن اعتماد هذه الحالة")
    previous_status = expense.status
    expense.status = "approved"

    # Snapshot before the commit: approving an expense is the operation that
    # actually moves money (it writes a `direction="out"` CashTransaction), so
    # it is the financial event most worth tracing back to a user + IP.
    snapshot = {
        "title": expense.title,
        "category": expense.category,
        "amount": float(expense.amount or 0),
        "payment_method": expense.payment_method,
        "previous_status": previous_status,
        "cash_movement_created": False,
    }

    if was_pending and expense.amount and float(expense.amount) > 0:
        existing = find_existing_cash_transaction(
            db,
            reference_type="expense",
            reference_id=expense.id,
            transaction_type="expense_payment",
        )
        if not existing:
            pm = str(expense.payment_method or "cash").strip().lower()
            try:
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
                    commit=False,
                )
            except ValueError as e:
                # Overdraft policy refused the movement — the approval must
                # not be recorded without its cash-box entry.
                db.rollback()
                raise HTTPException(status_code=400, detail=str(e))
            snapshot["cash_movement_created"] = True

    db.commit()
    db.refresh(expense)
    audit_log(
        db, request, current_user,
        action="approve_expense",
        entity_type="expense",
        entity_id=expense_id,
        description=snapshot,
    )
    db.refresh(expense)
    return _serialize_expense(expense, reveal_private=_is_owner_or_admin(current_user))


@router.post("/{expense_id}/reject", response_model=ExpenseRead)
def reject_expense(
    expense_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_admin),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Rejecting is the mirror of approving a *pending* expense. Only a
    # pending_audit expense can move to rejected — anything else means the
    # money already moved (or the decision is final elsewhere) and flipping
    # the label here would desync the cash box.
    if expense.status != "pending_audit":
        raise HTTPException(
            status_code=409,
            detail="يمكن رفض المصروف المعلّق فقط — المعتمد لا يمكن رفضه دون معالجة الخزينة",
        )

    # Rejecting blocks a payout, so it is the mirror of approve: both move the
    # expense across the audit boundary and both need a trail.
    snapshot = {
        "title": expense.title,
        "category": expense.category,
        "amount": float(expense.amount or 0),
        "previous_status": expense.status,
    }
    expense.status = "rejected"
    db.commit()
    db.refresh(expense)
    audit_log(
        db, request, current_user,
        action="reject_expense",
        entity_type="expense",
        entity_id=expense_id,
        description=snapshot,
    )
    return _serialize_expense(expense, reveal_private=_is_owner_or_admin(current_user))


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
    request: Request = None,
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

    was_approved = expense.status == "approved"
    amount_changed = payload.amount is not None and float(payload.amount) != float(expense.amount or 0)
    payment_changed = bool(payload.payment_method) and str(payload.payment_method).strip().lower() != str(expense.payment_method or "").strip().lower()

    # An approved expense already moved money. Editing the amount or payment
    # method here would leave the cash box permanently stale, so the linked
    # movement is voided and rewritten with the new figures. The old row is
    # kept (voided) for the audit trail — never deleted.
    cash_swap_needed = was_approved and (amount_changed or payment_changed)
    if cash_swap_needed:
        existing = find_existing_cash_transaction(
            db,
            reference_type="expense",
            reference_id=expense.id,
            transaction_type="expense_payment",
        )
        if existing:
            existing.is_voided = True
            existing.void_reason = "expense_edited"
            existing.voided_at = utc_now_naive()
            existing.voided_by = current_user.id
            db.add(existing)
            # Testing sessions run with autoflush=False; force the void to be
            # visible so the cash-box duplicate guard (find_existing_cash_-
            # transaction filters is_voided == 0) sees the old row as spent.
            db.flush()

    before = {
        "title": expense.title,
        "category": expense.category,
        "amount": float(expense.amount or 0),
        "payment_method": expense.payment_method,
        "expense_date": str(expense.expense_date) if expense.expense_date else None,
        "status": expense.status,
    }

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
    # NOTE: client-supplied `status` is ignored — the lifecycle moves through
    # /approve and /reject only.

    after = {
        "title": expense.title,
        "category": expense.category,
        "amount": float(expense.amount or 0),
        "payment_method": expense.payment_method,
        "expense_date": str(expense.expense_date) if expense.expense_date else None,
        "status": expense.status,
    }

    if cash_swap_needed:
        pm = str(expense.payment_method or "cash").strip().lower()
        try:
            create_cash_transaction(
                db,
                direction="out",
                amount=float(expense.amount),
                transaction_type="expense_payment",
                payment_method=pm or "cash",
                notes=f"مصروف (معدّل): {expense.title} - {expense.category}",
                user_id=current_user.id,
                reference_type="expense",
                reference_id=expense.id,
                reference_no=f"EXP-{expense.id}",
                commit=False,
            )
        except ValueError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    audit_log(
        db, request, current_user,
        action="update_expense",
        entity_type="expense",
        entity_id=expense_id,
        description={"before": before, "after": after, "cash_swap": cash_swap_needed},
    )

    db.commit()
    db.refresh(expense)
    expense = db.query(Expense).options(joinedload(Expense.created_by_user)).filter(Expense.id == expense_id).first()
    return _serialize_expense(expense, reveal_private=_is_owner_or_admin(current_user))


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """Hard delete of a financial record — permanently disabled.

    Raising 403 is the whole point of keeping this route: it returns a clear
    "not allowed" instead of a 404 from a removed path, so the UI can explain
    the policy instead of looking broken.

    No audit_log call here — the operation cannot happen. The financial events
    on this router that DO move money (`approve_expense`, which writes a
    `direction="out"` CashTransaction) are the audited ones.
    """
    raise HTTPException(
        status_code=403, 
        detail="حذف السجلات المالية غير مسموح به لضمان نزاهة البيانات"
    )
