from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import AliasChoices, BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_cashier_manager_owner, require_roles
from app.crud.core_business import create_audit_log
from app.db.session import get_db
from app.models.invoice import Invoice
from app.models.invoice_adjustment_request import InvoiceAdjustmentRequest
from app.models.notification import Notification
from app.models.user import User

router = APIRouter()

AdjustmentRequestType = Literal["discount", "payment_method", "void"]
RequestStatus = Literal["pending", "approved", "rejected", "all"]
ALLOWED_PAYMENT_METHODS = {"cash", "card", "bank_transfer", "wallet"}
require_adjustment_reviewer = require_roles("owner", "admin", "manager")


class AdjustmentRequestCreate(BaseModel):
    request_type: AdjustmentRequestType
    reason: str = Field(min_length=3, max_length=1000)
    notes: str | None = Field(default=None, max_length=2000)
    requested_values: dict[str, Any] = Field(default_factory=dict)


class AdjustmentDecision(BaseModel):
    manager_note: str | None = Field(
        default=None,
        max_length=2000,
        validation_alias=AliasChoices("manager_note", "managerNote"),
    )


def _serialize_request(row: InvoiceAdjustmentRequest) -> dict[str, Any]:
    requester = row.requested_by
    approver = row.approved_by
    return {
        "id": row.id,
        "invoice_id": row.invoice_id,
        "invoice_no": row.invoice.invoice_no if row.invoice else None,
        "request_type": row.request_type,
        "reason": row.reason,
        "notes": row.notes,
        "old_values": row.old_values or {},
        "requested_values": row.requested_values or {},
        "status": row.status,
        "requested_by_user_id": row.requested_by_user_id,
        "requested_by_name": (
            (requester.full_name or requester.username) if requester else None
        ),
        "approved_by_user_id": row.approved_by_user_id,
        "approved_by_name": (
            (approver.full_name or approver.username) if approver else None
        ),
        "decision_note": row.decision_note,
        "manager_note": row.decision_note,
        "created_at": row.created_at,
        "reviewed_at": row.reviewed_at,
    }


def _parse_nonnegative_decimal(value: Any) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="القيمة الرقمية المطلوبة غير صالحة")
    if not parsed.is_finite() or parsed < 0:
        raise HTTPException(status_code=400, detail="القيمة الرقمية يجب أن تكون صفرًا أو أكبر")
    return parsed.quantize(Decimal("0.01"))


def _validate_requested_change(
    invoice: Invoice,
    request_type: AdjustmentRequestType,
    requested_values: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    if request_type == "discount":
        raw_value = requested_values.get("new_value", requested_values.get("amount"))
        if raw_value is None:
            raise HTTPException(status_code=400, detail="قيمة الخصم الجديدة مطلوبة")
        new_discount = _parse_nonnegative_decimal(raw_value)
        subtotal = Decimal(str(invoice.subtotal_amount or 0))
        if new_discount > subtotal:
            raise HTTPException(status_code=400, detail="الخصم لا يمكن أن يتجاوز إجمالي الفاتورة")
        return (
            {"discount_amount": str(new_discount)},
            {"discount_amount": str(Decimal(str(invoice.discount_amount or 0)))},
        )

    if request_type == "payment_method":
        payment_method = str(requested_values.get("new_value", "")).strip().lower()
        if payment_method not in ALLOWED_PAYMENT_METHODS:
            raise HTTPException(status_code=400, detail="طريقة الدفع غير مدعومة")
        return (
            {"payment_method": payment_method},
            {"payment_method": invoice.payment_method},
        )

    if invoice.is_closed:
        raise HTTPException(status_code=400, detail="الفاتورة مغلقة بالفعل")
    return ({"void": True}, {"is_closed": invoice.is_closed})


def _apply_approved_request(
    db: Session,
    row: InvoiceAdjustmentRequest,
    reviewer: User,
) -> None:
    invoice = row.invoice
    request_type = row.request_type
    values = row.requested_values or {}

    if request_type == "discount":
        new_discount = _parse_nonnegative_decimal(
            values.get("new_value", values.get("discount_amount"))
        )
        subtotal = Decimal(str(invoice.subtotal_amount or 0))
        if new_discount > subtotal:
            raise HTTPException(status_code=400, detail="الخصم لا يمكن أن يتجاوز إجمالي الفاتورة")
        invoice.discount_amount = new_discount
        invoice.total_amount = subtotal - new_discount
    elif request_type == "payment_method":
        payment_method = str(
            values.get("new_value", values.get("payment_method", ""))
        ).strip().lower()
        if payment_method not in ALLOWED_PAYMENT_METHODS:
            raise HTTPException(status_code=400, detail="طريقة الدفع غير مدعومة")
        invoice.payment_method = payment_method
    elif request_type == "void":
        invoice.is_closed = True
        invoice.closed_at = datetime.now(timezone.utc)
        invoice.closed_by_user_id = reviewer.id
    else:
        raise HTTPException(status_code=400, detail="نوع التعديل غير مدعوم")

    db.add(invoice)


def _request_is_within_edit_window(invoice: Invoice) -> bool:
    if invoice.created_at is None:
        return True
    now = datetime.now(invoice.created_at.tzinfo) if invoice.created_at.tzinfo else datetime.now()
    return now <= invoice.created_at + timedelta(hours=1)


@router.get("/invoice-adjustment-requests")
def list_invoice_adjustment_requests(
    response: Response,
    request_status: RequestStatus | None = Query(default=None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(InvoiceAdjustmentRequest).options(
        joinedload(InvoiceAdjustmentRequest.invoice),
        joinedload(InvoiceAdjustmentRequest.requested_by),
        joinedload(InvoiceAdjustmentRequest.approved_by),
    )
    if current_user.role == "cashier":
        query = query.filter(
            InvoiceAdjustmentRequest.requested_by_user_id == current_user.id
        )
    if request_status and request_status != "all":
        query = query.filter(InvoiceAdjustmentRequest.status == request_status)

    total = query.count()
    rows = query.order_by(InvoiceAdjustmentRequest.id.desc()).offset(offset).limit(limit).all()
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page-Size"] = str(limit)
    response.headers["X-Offset"] = str(offset)
    return [_serialize_request(row) for row in rows]


@router.post(
    "/invoices/{invoice_id}/adjustment-requests",
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_adjustment_request(
    invoice_id: int,
    payload: AdjustmentRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if invoice is None:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    if not _request_is_within_edit_window(invoice):
        raise HTTPException(
            status_code=400,
            detail="لا يمكن تعديل الفاتورة بعد مرور أكثر من ساعة على إصدارها",
        )

    pending = (
        db.query(InvoiceAdjustmentRequest)
        .filter(
            InvoiceAdjustmentRequest.invoice_id == invoice.id,
            InvoiceAdjustmentRequest.status == "pending",
        )
        .first()
    )
    if pending is not None:
        raise HTTPException(
            status_code=409,
            detail="يوجد طلب تعديل قيد المراجعة لهذه الفاتورة",
        )

    normalized_values, old_values = _validate_requested_change(
        invoice,
        payload.request_type,
        payload.requested_values,
    )
    row = InvoiceAdjustmentRequest(
        invoice_id=invoice.id,
        requested_by_user_id=current_user.id,
        request_type=payload.request_type,
        reason=payload.reason.strip(),
        notes=payload.notes.strip() if payload.notes else None,
        old_values=old_values,
        requested_values=normalized_values,
        status="pending",
    )
    db.add(row)
    db.flush()

    recipients = db.query(User).filter(User.role.in_(["owner", "admin", "manager"])).all()
    for recipient in recipients:
        db.add(
            Notification(
                user_id=recipient.id,
                user_role=recipient.role,
                title="طلب تعديل فاتورة",
                message=f"فاتورة {invoice.invoice_no} تنتظر مراجعة التعديل",
            )
        )

    create_audit_log(
        db,
        action="INVOICE_ADJUSTMENT_REQUESTED",
        entity_name="invoice_adjustment_request",
        entity_id=str(row.id),
        user_id=current_user.id,
        user_name=current_user.full_name or current_user.username,
        old_values=old_values,
        new_values=normalized_values,
        commit=False,
    )
    db.commit()
    db.refresh(row)
    return _serialize_request(row)


def _decide_request(
    request_id: int,
    decision: AdjustmentDecision,
    reviewer: User,
    db: Session,
    approved: bool,
) -> dict[str, Any]:
    row = (
        db.query(InvoiceAdjustmentRequest)
        .options(
            joinedload(InvoiceAdjustmentRequest.invoice),
            joinedload(InvoiceAdjustmentRequest.requested_by),
            joinedload(InvoiceAdjustmentRequest.approved_by),
        )
        .filter(InvoiceAdjustmentRequest.id == request_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="طلب تعديل الفاتورة غير موجود")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="تمت مراجعة الطلب مسبقًا")
    if row.requested_by_user_id == reviewer.id:
        raise HTTPException(status_code=403, detail="لا يمكن مراجعة الطلب الذي أنشأه المستخدم نفسه")

    claimed = (
        db.query(InvoiceAdjustmentRequest)
        .filter(
            InvoiceAdjustmentRequest.id == request_id,
            InvoiceAdjustmentRequest.status == "pending",
        )
        .update(
            {InvoiceAdjustmentRequest.status: "processing"},
            synchronize_session=False,
        )
    )
    if claimed != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="تمت مراجعة الطلب مسبقًا")
    row.status = "processing"

    if approved:
        _apply_approved_request(db, row, reviewer)

    row.status = "approved" if approved else "rejected"
    row.approved_by_user_id = reviewer.id
    row.reviewed_at = datetime.now(timezone.utc)
    row.decision_note = decision.manager_note.strip() if decision.manager_note else None
    db.add(row)

    db.add(
        Notification(
            user_id=row.requested_by_user_id,
            user_role=row.requested_by.role if row.requested_by else None,
            title="تمت مراجعة طلب تعديل الفاتورة",
            message=f"طلب تعديل الفاتورة {row.invoice.invoice_no if row.invoice else row.invoice_id} تم {row.status}",
        )
    )
    create_audit_log(
        db,
        action=(
            "INVOICE_ADJUSTMENT_APPROVED"
            if approved
            else "INVOICE_ADJUSTMENT_REJECTED"
        ),
        entity_name="invoice_adjustment_request",
        entity_id=str(row.id),
        user_id=reviewer.id,
        user_name=reviewer.full_name or reviewer.username,
        new_values={"status": row.status, "decision_note": row.decision_note},
        commit=False,
    )
    db.commit()
    db.refresh(row)
    return _serialize_request(row)


@router.post("/invoice-adjustment-requests/{request_id}/approve")
def approve_invoice_adjustment_request(
    request_id: int,
    payload: AdjustmentDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_adjustment_reviewer),
):
    return _decide_request(request_id, payload, current_user, db, approved=True)


@router.post("/invoice-adjustment-requests/{request_id}/reject")
def reject_invoice_adjustment_request(
    request_id: int,
    payload: AdjustmentDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_adjustment_reviewer),
):
    return _decide_request(request_id, payload, current_user, db, approved=False)
