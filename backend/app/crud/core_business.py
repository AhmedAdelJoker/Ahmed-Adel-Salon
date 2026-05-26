from fastapi.middleware.cors import CORSMiddleware
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


def get_cash_balance(db: Session):
    total_in = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "in",
        CashTransaction.is_voided == 0
    ).scalar() or 0

    total_out = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "out",
        CashTransaction.is_voided == 0
    ).scalar() or 0

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
):
    if not reference_type or reference_id is None or not transaction_type:
        return None

    return (
        db.query(CashTransaction)
        .filter(
            CashTransaction.reference_type == reference_type,
            CashTransaction.reference_id == reference_id,
            CashTransaction.type == transaction_type,
            CashTransaction.is_voided == 0,
        )
        .order_by(CashTransaction.id.desc())
        .first()
    )

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
        )
        if existing_transaction is not None:
            return existing_transaction

    if amount <= 0:
        raise ValueError("قيمة حركة الخزنة يجب أن تكون أكبر من صفر")

    if direction not in ("in", "out"):
        raise ValueError("اتجاه حركة الخزنة غير صحيح")

    current_balance = get_cash_balance(db)
    balance_after = current_balance + amount if direction == "in" else current_balance - amount

    row = CashTransaction(
        transaction_no=generate_cash_transaction_no(),
        type=transaction_type,
        direction=direction,
        amount=amount,
        balance_after=balance_after,
        payment_method=payment_method or "cash",
        notes=notes,
        user_id=user_id,
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


def list_audit_logs(db: Session, limit: int = 50):
    return (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .all()
    )


def get_dashboard_core_summary(db: Session):
    total_in = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "in",
        CashTransaction.is_voided == 0
    ).scalar() or 0

    total_out = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "out",
        CashTransaction.is_voided == 0
    ).scalar() or 0

    today = datetime.utcnow().date()

    today_sales = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "in",
        CashTransaction.is_voided == 0,
        func.date(CashTransaction.transaction_date) == str(today)
    ).scalar() or 0

    today_expenses = db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.direction == "out",
        CashTransaction.is_voided == 0,
        func.date(CashTransaction.transaction_date) == str(today)
    ).scalar() or 0

    total_in = float(total_in)
    total_out = float(total_out)
    today_sales = float(today_sales)
    today_expenses = float(today_expenses)

    return {
        "total_in": total_in,
        "total_out": total_out,
        "cash_balance": total_in - total_out,
        "today_sales": today_sales,
        "today_expenses": today_expenses,
        "today_net": today_sales - today_expenses,
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




