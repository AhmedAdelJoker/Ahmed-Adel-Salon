from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.api import deps
from app.schemas.core_business import CashTransactionCreate, CashTransactionOut, DashboardCoreSummary
from app.crud.core_business import (
    get_cash_balance,
    get_dashboard_core_summary,
    create_cash_transaction,
    create_audit_log,
)
from app.models.cash_transaction import CashTransaction
from app.models.business_settings import BusinessSettings
from app.models.shop_settings import ShopSettings
from app.models.user import User
from app.services.pdf_service import generate_cash_receipt_pdf

router = APIRouter(prefix="/cashbox", tags=["cashbox"])


@router.get("/balance")
def cashbox_balance(
    payment_method: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner)
):
    # payment_method: cash | non_cash | all | card | bank_transfer | wallet
    pm = payment_method or "all"
    if pm == "all":
        pm = None
    return {
        "balance": get_cash_balance(db),
        "cash_balance": get_cash_balance(db, payment_method="cash"),
        "non_cash_balance": get_cash_balance(db, payment_method="non_cash"),
        "filtered_balance": get_cash_balance(db, payment_method=pm) if pm else get_cash_balance(db),
    }


@router.get("/summary", response_model=DashboardCoreSummary)
def cashbox_summary(
    period: Optional[str] = Query(None, description="day/week/month/year/all"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner)
):
    """خزنة مركزية ديناميكية — تدعم فلترة المدة (يوم/أسبوع/شهر/سنة/مخصص)."""
    return get_dashboard_core_summary(db, period=period, from_date=from_date, to_date=to_date)


@router.get("/stats")
def cashbox_stats(
    period: Optional[str] = Query(None, description="day/week/month/year/all"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner)
):
    """Aggregated stats: 7-day trend + breakdown + cash vs non-cash (يدعم المدة)."""
    from datetime import timedelta, date

    summary = get_dashboard_core_summary(db, period=period, from_date=from_date, to_date=to_date)

    # Build last 7 days — include cash + non-cash splits
    trend = []
    today = date.today()
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        day_in = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
            CashTransaction.direction == "in",
            CashTransaction.is_voided == 0,
            func.date(CashTransaction.transaction_date) == d_str,
        ).scalar() or 0
        day_out = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
            CashTransaction.direction == "out",
            CashTransaction.is_voided == 0,
            func.date(CashTransaction.transaction_date) == d_str,
        ).scalar() or 0
        cash_in = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
            CashTransaction.direction == "in",
            CashTransaction.is_voided == 0,
            CashTransaction.payment_method == "cash",
            func.date(CashTransaction.transaction_date) == d_str,
        ).scalar() or 0
        non_cash_in = float(day_in) - float(cash_in)
        trend.append({
            "date": d_str,
            "label": d.strftime("%a"),
            "in": float(day_in),
            "out": float(day_out),
            "net": float(day_in) - float(day_out),
            "cash_in": float(cash_in),
            "non_cash_in": float(non_cash_in),
        })

    # Type breakdown
    rows = db.query(
        CashTransaction.type, func.sum(CashTransaction.amount).label("total")
    ).filter(CashTransaction.is_voided == 0).group_by(CashTransaction.type).all()
    breakdown = [{"type": r.type, "value": float(r.total or 0)} for r in rows]

    # Payment method breakdown
    pm_rows = db.query(
        CashTransaction.payment_method, func.sum(CashTransaction.amount).label("total")
    ).filter(CashTransaction.is_voided == 0).group_by(CashTransaction.payment_method).all()
    by_method = [{"method": (r.payment_method or "cash"), "value": float(r.total or 0)} for r in pm_rows]

    # Cashier drawer live balance
    drawer = {"balance": summary.get("drawer_balance", 0), "open_shifts": summary.get("drawer_open_shifts", 0)}

    return {"summary": summary, "trend": trend, "breakdown": breakdown, "by_method": by_method, "drawer": drawer}


def _enrich_tx(tx: CashTransaction) -> CashTransaction:
    # إثراء مؤقت للعرض: انسخ recipient من notes إن وجد prefix
    try:
        if not getattr(tx, "recipient_name", None) and tx.notes and "المستفيد:" in tx.notes:
            tx.recipient_name = tx.notes.split("المستفيد:")[1].strip().split("\n")[0].strip()[:100]
    except Exception:
        pass
    return tx


@router.get("/transactions/{transaction_id}", response_model=CashTransactionOut)
def get_cash_transaction(
    transaction_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_cashier_manager_owner),
):
    from sqlalchemy.orm import joinedload
    tx = db.query(CashTransaction).options(joinedload(CashTransaction.created_by_user), joinedload(CashTransaction.user)).filter(CashTransaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="الحركة غير موجودة")
    return _enrich_tx(tx)


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
    from sqlalchemy.orm import joinedload
    query = db.query(CashTransaction).options(joinedload(CashTransaction.created_by_user), joinedload(CashTransaction.user))

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
        if payment_method == "non_cash":
            query = query.filter(CashTransaction.payment_method != "cash")
        elif payment_method == "cash":
            query = query.filter(CashTransaction.payment_method == "cash")
        else:
            query = query.filter(CashTransaction.payment_method == payment_method)

    if is_voided is not None:
        # DB stores boolean/int (True/1) — accept both
        if is_voided:
            query = query.filter(or_(CashTransaction.is_voided == True, CashTransaction.is_voided == 1))  # noqa: E712
        else:
            query = query.filter(or_(CashTransaction.is_voided == False, CashTransaction.is_voided == 0))  # noqa: E712

    query = query.order_by(CashTransaction.transaction_date.desc(), CashTransaction.id.desc())

    # Pagination: page overrides offset
    if page is not None:
        offset = (page - 1) * limit

    rows = query.offset(offset).limit(limit).all()
    return [_enrich_tx(r) for r in rows]


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
        # تفاصيل أكثر عند الإنشاء: المستفيد + المرجع يُضاف للملاحظات مع الحفاظ على التوافق
        enriched_notes = payload.notes or ""
        if payload.recipient_name:
            enriched_notes = f"{enriched_notes}\nالمستفيد: {payload.recipient_name}".strip()
        if payload.reference_no:
            enriched_notes = f"{enriched_notes}\nالمرجع: {payload.reference_no}".strip()

        row = create_cash_transaction(
            db,
            direction=payload.direction,
            amount=payload.amount,
            transaction_type=transaction_type,
            payment_method=payload.payment_method or "cash",
            notes=enriched_notes or payload.notes,
            user_id=current_user.id,
            reference_no=payload.reference_no,
        )
        # تأكد أن المنشئ يظهر في الرد مباشرة (عالمي متوسط)
        try:
            row.created_by_user_id = current_user.id
            row.created_by_user = current_user  # type: ignore
            row.user = current_user  # type: ignore
        except Exception:
            pass

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



