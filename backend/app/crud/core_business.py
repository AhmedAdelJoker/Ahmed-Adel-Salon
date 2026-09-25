import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.shop_settings import ShopSettings
from app.models.cash_transaction import CashTransaction
from app.models.audit_log_core import AuditLog


def safe_json(value):
    if value is None:
        return None
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return None


def generate_cash_transaction_no():
    return f"CASH-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def get_shop_settings(db: Session):
    settings = db.query(ShopSettings).filter(ShopSettings.id == 1).first()
    if not settings:
        settings = ShopSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_shop_settings(db: Session, payload: dict):
    settings = get_shop_settings(db)

    for key, value in payload.items():
        if value is not None and hasattr(settings, key):
            setattr(settings, key, value)

    settings.updated_at = datetime.utcnow()
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def get_cash_balance(db: Session, payment_method: str | None = None):
    """Total balance. If payment_method == 'cash' -> cash vault only, 'non_cash' -> digital vault."""
    q_in = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "in",
        CashTransaction.is_voided == 0
    )
    q_out = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "out",
        CashTransaction.is_voided == 0
    )
    if payment_method == "cash":
        q_in = q_in.filter(CashTransaction.payment_method == "cash")
        q_out = q_out.filter(CashTransaction.payment_method == "cash")
    elif payment_method == "non_cash":
        q_in = q_in.filter(CashTransaction.payment_method != "cash")
        q_out = q_out.filter(CashTransaction.payment_method != "cash")
    elif payment_method and payment_method != "all":
        q_in = q_in.filter(CashTransaction.payment_method == payment_method)
        q_out = q_out.filter(CashTransaction.payment_method == payment_method)

    total_in = q_in.scalar() or 0
    total_out = q_out.scalar() or 0
    return float(total_in) - float(total_out)


def list_cash_transactions(db: Session, limit: int = 50):
    return (
        db.query(CashTransaction)
        .order_by(CashTransaction.transaction_date.desc(), CashTransaction.id.desc())
        .limit(limit)
        .all()
    )




def find_existing_cash_transaction(
    db: Session,
    *,
    reference_type: str | None,
    reference_id: int | None,
    transaction_type: str,
    reference_no: str | None = None,
):
    if not reference_type or reference_id is None or not transaction_type:
        return None

    query = db.query(CashTransaction).filter(
        CashTransaction.reference_type == reference_type,
        CashTransaction.reference_id == reference_id,
        CashTransaction.type == transaction_type,
        CashTransaction.is_voided == 0,
    )
    if reference_no is not None:
        query = query.filter(CashTransaction.reference_no == reference_no)
    return query.order_by(CashTransaction.id.desc()).first()

def create_cash_transaction(
    db: Session,
    *,
    direction: str,
    amount: float,
    transaction_type: str,
    payment_method: str = "cash",
    notes: str | None = None,
    user_id: int | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    reference_no: str | None = None,
    customer_id: int | None = None,
    employee_id: int | None = None,
    commit: bool = True,
    prevent_duplicate: bool = True,
):
    if prevent_duplicate:
        existing_transaction = find_existing_cash_transaction(
            db,
            reference_type=reference_type,
            reference_id=reference_id,
            transaction_type=transaction_type,
            reference_no=reference_no,
        )
        if existing_transaction is not None:
            return existing_transaction

    if amount <= 0:
        raise ValueError("قيمة حركة الخزنة يجب أن تكون أكبر من صفر")

    if direction not in ("in", "out"):
        raise ValueError("اتجاه حركة الخزنة غير صحيح")

    current_balance = get_cash_balance(db)
    balance_after = current_balance + amount if direction == "in" else current_balance - amount

    # Enforce allow_negative_cash setting: block overdraft if disabled
    if direction == "out" and balance_after < 0:
        settings = get_shop_settings(db)
        if int(getattr(settings, "allow_negative_cash", 0) or 0) != 1:
            raise ValueError(f"الرصيد غير كافي. المتاح: {current_balance:.2f} ج.م — فعّل السماح بالسحب على المكشوف من الإعدادات")

    row = CashTransaction(
        transaction_no=generate_cash_transaction_no(),
        type=transaction_type,
        direction=direction,
        amount=amount,
        balance_after=balance_after,
        payment_method=payment_method or "cash",
        notes=notes,
        user_id=user_id,
        created_by_user_id=user_id,
        reference_type=reference_type,
        reference_id=reference_id,
        reference_no=reference_no,
        customer_id=customer_id,
        employee_id=employee_id,
    )

    db.add(row)

    if commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()

    return row


def create_audit_log(
    db: Session,
    *,
    action: str,
    entity_name: str,
    entity_id: str | None = None,
    user_id: int | None = None,
    user_name: str | None = None,
    old_values=None,
    new_values=None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    device_name: str | None = None,
    commit: bool = True,
):
    row = AuditLog(
        action=action,
        entity_name=entity_name,
        entity_id=str(entity_id) if entity_id is not None else None,
        user_id=user_id,
        user_name=user_name,
        old_values=safe_json(old_values),
        new_values=safe_json(new_values),
        ip_address=ip_address,
        user_agent=user_agent,
        device_name=device_name,
    )

    db.add(row)

    if commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()

    return row


def list_audit_logs(db: Session, limit: int = 50, offset: int = 0):
    """Phase 2: bounded pagination + count for X-Total-Count header."""
    total = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .count()
    )
    rows = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return rows, total


def _sum_filtered(db: Session, direction: str, payment_filter: str | None, date_str: str | None = None, start: str | None = None, end: str | None = None):
    q = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == direction,
        CashTransaction.is_voided == 0,
    )
    if payment_filter == "cash":
        q = q.filter(CashTransaction.payment_method == "cash")
    elif payment_filter == "non_cash":
        q = q.filter(CashTransaction.payment_method != "cash")
    if date_str:
        q = q.filter(func.date(CashTransaction.transaction_date) == date_str)
    if start:
        q = q.filter(func.date(CashTransaction.transaction_date) >= start)
    if end:
        q = q.filter(func.date(CashTransaction.transaction_date) <= end)
    return float(q.scalar() or 0)


def _resolve_period_range(period: str | None, from_date: str | None, to_date: str | None):
    """حساب start/end لفلترة المدة: day/week/month/year/custom/all"""
    from datetime import date, timedelta
    today = date.today()
    if period == "day":
        s = e = today.isoformat()
        return s, e, "اليوم"
    if period == "week":
        # أسبوع يبدأ الاثنين
        start = today - timedelta(days=today.weekday())
        return start.isoformat(), today.isoformat(), "هذا الأسبوع"
    if period == "month":
        start = today.replace(day=1)
        return start.isoformat(), today.isoformat(), "هذا الشهر"
    if period == "year":
        start = today.replace(month=1, day=1)
        return start.isoformat(), today.isoformat(), "هذه السنة"
    if from_date or to_date:
        # custom
        s = from_date or "2000-01-01"
        e = to_date or today.isoformat()
        return s, e, "مخصص"
    return None, None, "الكل"


def get_dashboard_core_summary(db: Session, period: str | None = None, from_date: str | None = None, to_date: str | None = None):
    total_in = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "in",
        CashTransaction.is_voided == 0
    ).scalar() or 0

    total_out = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "out",
        CashTransaction.is_voided == 0
    ).scalar() or 0

    today = datetime.utcnow().date()
    today_str = str(today)

    today_sales = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "in",
        CashTransaction.is_voided == 0,
        func.date(CashTransaction.transaction_date) == today_str
    ).scalar() or 0

    today_expenses = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "out",
        CashTransaction.is_voided == 0,
        func.date(CashTransaction.transaction_date) == today_str
    ).scalar() or 0

    total_in = float(total_in)
    total_out = float(total_out)
    today_sales = float(today_sales)
    today_expenses = float(today_expenses)

    # --- تفصيل الكاش vs غير الكاش (إجمالي) ---
    cash_in = _sum_filtered(db, "in", "cash")
    cash_out = _sum_filtered(db, "out", "cash")
    non_cash_in = _sum_filtered(db, "in", "non_cash")
    non_cash_out = _sum_filtered(db, "out", "non_cash")

    cash_today_sales = _sum_filtered(db, "in", "cash", today_str)
    cash_today_expenses = _sum_filtered(db, "out", "cash", today_str)
    non_cash_today_sales = _sum_filtered(db, "in", "non_cash", today_str)
    non_cash_today_expenses = _sum_filtered(db, "out", "non_cash", today_str)

    # --- فلترة المدة (يوم/أسبوع/شهر/سنة/مخصص) — لحساب شخصي + تقرير حركة ---
    period_start, period_end, period_label = _resolve_period_range(period, from_date, to_date)
    if period_start and period_end:
        period_in = _sum_filtered(db, "in", None, start=period_start, end=period_end)
        period_out = _sum_filtered(db, "out", None, start=period_start, end=period_end)
        period_cash_in = _sum_filtered(db, "in", "cash", start=period_start, end=period_end)
        period_cash_out = _sum_filtered(db, "out", "cash", start=period_start, end=period_end)
        period_non_cash_in = _sum_filtered(db, "in", "non_cash", start=period_start, end=period_end)
        period_non_cash_out = _sum_filtered(db, "out", "non_cash", start=period_start, end=period_end)
    else:
        period_in = total_in
        period_out = total_out
        period_cash_in = cash_in
        period_cash_out = cash_out
        period_non_cash_in = non_cash_in
        period_non_cash_out = non_cash_out
        period_start = None
        period_end = None
        period_label = "الكل"

    # Breakdown by payment_method (مع احترام المدة إن وجدت)
    by_method: dict[str, float] = {}
    qm = db.query(CashTransaction.payment_method, func.sum(CashTransaction.amount)).filter(CashTransaction.is_voided == 0)
    if period_start and period_end:
        qm = qm.filter(func.date(CashTransaction.transaction_date) >= period_start, func.date(CashTransaction.transaction_date) <= period_end)
    rows = qm.group_by(CashTransaction.payment_method).all()
    for pm, total in rows:
        key = pm or "cash"
        by_method[str(key)] = float(total or 0)

    # رصيد ورديات الكاشير المفتوحة (drawer) — فقط الكاش يؤثر على الدرج
    drawer_balance = 0.0
    drawer_open_shifts = 0
    try:
        from app.models.pos_shift import PosShift
        from app.models.invoice import Invoice
        from datetime import timedelta
        from decimal import Decimal
        open_shifts = db.query(PosShift).filter(PosShift.status == "open").all()
        drawer_open_shifts = len(open_shifts)
        total_opening = sum(float(s.opening_cash or 0) for s in open_shifts)
        total_cash_sales = 0.0
        for s in open_shifts:
            shift_start = s.opened_at - timedelta(seconds=1) if s.opened_at else datetime.utcnow()
            invoices = db.query(Invoice).filter(
                Invoice.created_at >= shift_start,
                Invoice.created_by_user_id == s.user_id,
                Invoice.is_draft == False,
            ).all()
            for inv in invoices:
                pm = str(inv.payment_method or "").upper()
                # cash + split cash portion
                if pm == "CASH":
                    total_cash_sales += float(inv.total_amount or 0)
                elif pm == "SPLIT":
                    # approximate: count split cash if any
                    # We don't store split details in invoices, so estimate via cashbox transactions for this shift
                    pass
        # fallback: also sum cashbox cash_in for today open shifts as proxy
        drawer_balance = total_opening + total_cash_sales
        # If no open shifts but we have cash transactions, drawer mirrors cash_balance_detail for consistency
        if drawer_open_shifts == 0:
            drawer_balance = cash_in - cash_out
    except Exception:
        drawer_balance = cash_in - cash_out

    return {
        "total_in": total_in,
        "total_out": total_out,
        "cash_balance": total_in - total_out,
        "today_sales": today_sales,
        "today_expenses": today_expenses,
        "today_net": today_sales - today_expenses,
        "cash_in": cash_in,
        "cash_out": cash_out,
        "cash_balance_detail": cash_in - cash_out,
        "non_cash_in": non_cash_in,
        "non_cash_out": non_cash_out,
        "non_cash_balance": non_cash_in - non_cash_out,
        "cash_today_sales": cash_today_sales,
        "cash_today_expenses": cash_today_expenses,
        "cash_today_net": cash_today_sales - cash_today_expenses,
        "non_cash_today_sales": non_cash_today_sales,
        "non_cash_today_expenses": non_cash_today_expenses,
        "non_cash_today_net": non_cash_today_sales - non_cash_today_expenses,
        "drawer_balance": float(drawer_balance),
        "drawer_open_shifts": int(drawer_open_shifts),
        "by_payment_method": by_method,
        # المدة المختارة — حساب شخصي + تقرير حركة
        "period_label": period_label,
        "period_start": period_start,
        "period_end": period_end,
        "period_in": float(period_in),
        "period_out": float(period_out),
        "period_net": float(period_in - period_out),
        "period_cash_in": float(period_cash_in),
        "period_cash_out": float(period_cash_out),
        "period_cash_net": float(period_cash_in - period_cash_out),
        "period_non_cash_in": float(period_non_cash_in),
        "period_non_cash_out": float(period_non_cash_out),
        "period_non_cash_net": float(period_non_cash_in - period_non_cash_out),
    }


def void_cash_transactions_by_reference(
    db: Session,
    *,
    reference_type: str,
    reference_id: int,
    reason: str | None = None,
    user_id: int | None = None,
    commit: bool = True,
):
    rows = (
        db.query(CashTransaction)
        .filter(
            CashTransaction.reference_type == reference_type,
            CashTransaction.reference_id == reference_id,
            CashTransaction.is_voided == 0,
        )
        .all()
    )

    for row in rows:
        row.is_voided = 1
        row.void_reason = reason or f"Void {reference_type} #{reference_id}"
        row.voided_at = datetime.utcnow()
        row.voided_by = user_id
        row.updated_at = datetime.utcnow()
        db.add(row)

    if commit:
        db.commit()
        for row in rows:
            db.refresh(row)
    else:
        db.flush()

    return rows




