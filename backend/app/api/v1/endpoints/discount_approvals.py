from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import require_cashier_manager_owner, require_owner_or_manager
from app.db.session import get_db
from app.models.discount_approval_request import DiscountApprovalRequest
from app.models.invoice import Invoice
from app.models.notification import Notification
from app.models.user import User
from app.schemas.discount_approval import (
    DiscountApprovalDecision,
    DiscountApprovalRequestCreate,
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/discount-approvals", tags=["Discount Approvals"])


def _serialize_request(db: Session, row: DiscountApprovalRequest):
    requester = db.query(User).filter(User.id == row.requested_by_user_id).first()
    approver = db.query(User).filter(User.id == row.approved_by_user_id).first() if row.approved_by_user_id else None
    invoice = db.query(Invoice).filter(Invoice.id == row.invoice_id).first()
    return {
        "id": row.id,
        "invoice_id": row.invoice_id,
        "requested_by_user_id": row.requested_by_user_id,
        "requested_discount_amount": float(row.requested_discount_amount or 0),
        "reason": row.reason,
        "status": row.status,
        "decision_note": row.decision_note,
        "approved_by_user_id": row.approved_by_user_id,
        "approved_at": row.approved_at,
        "created_at": row.created_at,
        "invoice_no": invoice.invoice_no if invoice else None,
        "requested_by_name": requester.full_name or requester.username if requester else None,
        "approved_by_name": approver.full_name or approver.username if approver else None,
    }


@router.get("")
def list_discount_approvals(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(DiscountApprovalRequest).order_by(DiscountApprovalRequest.id.desc())
    if current_user.role == "cashier":
        query = query.filter(DiscountApprovalRequest.requested_by_user_id == current_user.id)
    response.headers["X-Total-Count"] = str(query.count())
    return [_serialize_request(db, row) for row in query.offset(skip).limit(limit).all()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_discount_request(
    payload: DiscountApprovalRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    invoice = db.query(Invoice).filter(Invoice.id == payload.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pending = (
        db.query(DiscountApprovalRequest)
        .filter(
            DiscountApprovalRequest.invoice_id == payload.invoice_id,
            DiscountApprovalRequest.status == "pending",
        )
        .first()
    )
    if pending:
        raise HTTPException(status_code=400, detail="There is already a pending request for this invoice")

    row = DiscountApprovalRequest(
        invoice_id=payload.invoice_id,
        requested_by_user_id=current_user.id,
        requested_discount_amount=payload.requested_discount_amount,
        reason=payload.reason,
        status="pending",
    )
    db.add(row)
    recipients = db.query(User).filter(User.role.in_(["manager", "owner"])).all()
    for recipient in recipients:
        db.add(
            Notification(
                user_id=recipient.id,
                user_role=recipient.role,
                title="Discount approval needed",
                message=f"Invoice {invoice.invoice_no} needs manager approval for a discount",
            )
        )
    log_activity(
        db,
        user_id=current_user.id,
        action="discount_request_created",
        entity_type="discount_approval_request",
        entity_id=None,
        description=f"Requested discount {payload.requested_discount_amount} for invoice {invoice.invoice_no}",
    )
    db.commit()
    db.refresh(row)
    return _serialize_request(db, row)


@router.post("/{request_id}/approve")
def approve_discount_request(
    request_id: int,
    payload: DiscountApprovalDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    row = db.query(DiscountApprovalRequest).filter(DiscountApprovalRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Discount request not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Discount request is not pending")

    invoice = db.query(Invoice).filter(Invoice.id == row.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    subtotal = Decimal(str(invoice.subtotal_amount or 0))
    if subtotal <= 0:
        subtotal = Decimal(str(invoice.total_amount or 0)) + Decimal(str(invoice.discount_amount or 0))
        invoice.subtotal_amount = subtotal

    requested_discount = Decimal(str(row.requested_discount_amount or 0))
    if requested_discount > subtotal:
        requested_discount = subtotal

    invoice.discount_amount = requested_discount
    invoice.discount_reason = row.reason
    invoice.discount_approved_by_user_id = current_user.id
    invoice.total_amount = subtotal - requested_discount

    row.status = "approved"
    row.decision_note = payload.decision_note
    row.approved_by_user_id = current_user.id
    row.approved_at = datetime.utcnow()

    db.add(invoice)
    db.add(row)
    log_activity(
        db,
        user_id=current_user.id,
        action="discount_request_approved",
        entity_type="discount_approval_request",
        entity_id=row.id,
        description=f"Approved discount request for invoice {invoice.invoice_no}",
    )
    db.commit()
    db.refresh(row)
    return _serialize_request(db, row)


@router.post("/{request_id}/reject")
def reject_discount_request(
    request_id: int,
    payload: DiscountApprovalDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    row = db.query(DiscountApprovalRequest).filter(DiscountApprovalRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Discount request not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Discount request is not pending")

    row.status = "rejected"
    row.decision_note = payload.decision_note
    row.approved_by_user_id = current_user.id
    row.approved_at = datetime.utcnow()
    db.add(row)
    log_activity(
        db,
        user_id=current_user.id,
        action="discount_request_rejected",
        entity_type="discount_approval_request",
        entity_id=row.id,
        description=f"Rejected discount request {row.id}",
    )
    db.commit()
    db.refresh(row)
    return _serialize_request(db, row)



