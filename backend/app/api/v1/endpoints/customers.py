from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from fastapi.responses import JSONResponse
from sqlalchemy.sql import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.db.session import get_db
from app.api.deps import require_any_staff, require_owner, require_owner_or_manager
from app.models.user import User
from app.models.customer import Customer
from app.models.appointment import Appointment
from app.models.barber import Barber
from app.models.activity_log import ActivityLog
from app.models.invoice import Invoice
from app.models.service_session import ServiceSession
from app.models.customer_cancellation_log import CustomerCancellationLog
from app.models.waitlist_entry import WaitlistEntry
from app.models.walk_in_queue import WalkInQueue
from app.schemas.customer import (
    CustomerCreate,
    CustomerRead,
    CustomerSearchRead,
    CustomerUpdate,
    CustomerArchiveRead,
)

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=list[CustomerRead])
def list_customers(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    return (
        db.query(Customer)
        .filter(Customer.is_deleted == False)
        .order_by(Customer.customer_id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/search", response_model=list[CustomerRead])
def search_customers_by_phone(
    phone: str = Query(..., min_length=3, max_length=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    customers = (
        db.query(Customer)
        .filter(Customer.phone.contains(phone))
        .filter(Customer.is_deleted == False)
        .all()
    )
    return customers


@router.get("/archive", response_model=list[CustomerArchiveRead])
def list_archived_customers(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """List all soft-deleted (archived) customers. Owner and Manager can view."""
    return (
        db.query(Customer)
        .options(joinedload(Customer.deleted_by))
        .filter(Customer.is_deleted == True)
        .order_by(Customer.deleted_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    return customer


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    # Check for existing customer by phone (including deleted ones)
    existing_customer = db.query(Customer).filter(Customer.phone == payload.phone).first()
    
    if existing_customer:
        if not existing_customer.is_deleted:
            raise HTTPException(status_code=400, detail="رقم الهاتف مسجل بالفعل لعميل نشط")
        
        # Reactivate deleted customer
        existing_customer.is_deleted = False
        existing_customer.deleted_at = None
        existing_customer.first_name = payload.first_name
        existing_customer.last_name = payload.last_name
        existing_customer.email = payload.email
        existing_customer.notes = payload.notes
        
        # Log reactivation
        log = ActivityLog(
            user_id=current_user.id,
            action="reactivate",
            entity_type="customer",
            entity_id=existing_customer.customer_id,
            description=f"إعادة تنشيط العميل: {existing_customer.first_name} {existing_customer.last_name} (رقم: {existing_customer.phone})"
        )
        db.add(log)
        
        db.commit()
        db.refresh(existing_customer)
        return existing_customer

    customer = Customer(
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        email=payload.email,
        notes=payload.notes,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    customer.first_name = payload.first_name
    customer.last_name = payload.last_name
    customer.phone = payload.phone
    customer.email = payload.email
    customer.notes = payload.notes

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    archive_reason: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    if customer.is_deleted:
        raise HTTPException(status_code=400, detail="العميل محذوف بالفعل")

    customer.is_deleted = True
    customer.deleted_at = func.now()
    customer.deleted_by_user_id = current_user.id
    customer.archive_reason = archive_reason
    
    # Log soft delete
    log = ActivityLog(
        user_id=current_user.id,
        action="soft_delete",
        entity_type="customer",
        entity_id=customer.customer_id,
        description=f"حذف ناعم للعميل: {customer.first_name} {customer.last_name} (رقم: {customer.phone}) - السبب: {archive_reason}"
    )
    db.add(log)
    
    db.commit()
    return None


@router.post("/{customer_id}/restore", response_model=CustomerRead)
def restore_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Restore a soft-deleted customer. Owner only."""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    
    if not customer.is_deleted:
        raise HTTPException(status_code=400, detail="العميل نشط بالفعل وليس في الأرشيف")
    
    customer.is_deleted = False
    customer.deleted_at = None
    
    # Log restoration
    log = ActivityLog(
        user_id=current_user.id,
        action="restore",
        entity_type="customer",
        entity_id=customer.customer_id,
        description=f"استعادة العميل من الأرشيف: {customer.first_name} {customer.last_name} (رقم: {customer.phone})"
    )
    db.add(log)
    
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def permanent_delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Permanently delete a customer (GDPR compliance). Owner only.
    Note: This will fail if customer has related invoices/appointments due to FK constraints.
    """
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    # Log permanent deletion before deleting
    log = ActivityLog(
        user_id=current_user.id,
        action="permanent_delete",
        entity_type="customer",
        entity_id=customer.customer_id,
        description=f"حذف نهائي للعميل: {customer.first_name} {customer.last_name} (رقم: {customer.phone})"
    )
    db.add(log)

    db.delete(customer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "لا يمكن الحذف النهائي — العميل لديه سجلات مرتبطة "
                "(فواتير، مواعيد، سجلات حضور، إلخ). "
                "احتفظ به في الأرشيف أو احذف السجلات المرتبطة أولاً."
            ),
        )
    return None


@router.post("/archive/bulk-restore", response_model=list[CustomerRead])
def bulk_restore_customers(
    customer_ids: list[int] = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Bulk restore multiple archived customers. Owner only."""
    if not customer_ids:
        raise HTTPException(status_code=400, detail="قائمة العملاء فارغة")
    
    customers = db.query(Customer).filter(
        Customer.customer_id.in_(customer_ids),
        Customer.is_deleted == True
    ).all()
    
    if not customers:
        raise HTTPException(status_code=404, detail="لا يوجد عملاء في الأرشيف بالمعرفات المحددة")
    
    restored = []
    for customer in customers:
        customer.is_deleted = False
        customer.deleted_at = None
        
        log = ActivityLog(
            user_id=current_user.id,
            action="restore",
            entity_type="customer",
            entity_id=customer.customer_id,
            description=f"استعادة جماعية - العميل: {customer.first_name} {customer.last_name} (رقم: {customer.phone})"
        )
        db.add(log)
        restored.append(customer)
    
    db.commit()
    for c in restored:
        db.refresh(c)
    return restored


@router.delete("/archive/bulk-permanent", status_code=status.HTTP_204_NO_CONTENT)
def bulk_permanent_delete_customers(
    customer_ids: list[int] = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Bulk permanently delete multiple archived customers (GDPR). Owner only."""
    if not customer_ids:
        raise HTTPException(status_code=400, detail="قائمة العملاء فارغة")

    customers = db.query(Customer).filter(
        Customer.customer_id.in_(customer_ids),
        Customer.is_deleted == True
    ).all()

    if not customers:
        raise HTTPException(status_code=404, detail="لا يوجد عملاء في الأرشيف بالمعرفات المحددة")

    # Pre-check: detect which customers have related records so the user gets
    # a precise, actionable error instead of an opaque 500 IntegrityError.
    blocked = []
    safe_to_delete = []
    for customer in customers:
        related_count = (
            db.query(Appointment).filter(Appointment.customer_id == customer.customer_id).count()
            + db.query(Invoice).filter(Invoice.customer_id == customer.customer_id).count()
        )
        # Also check other non-null FKs (ServiceSession, CustomerCancellationLog, WaitlistEntry, WalkInQueue)
        related_count += (
            db.query(ServiceSession).filter(ServiceSession.customer_id == customer.customer_id).count()
            + db.query(CustomerCancellationLog).filter(CustomerCancellationLog.customer_id == customer.customer_id).count()
            + db.query(WaitlistEntry).filter(WaitlistEntry.customer_id == customer.customer_id).count()
            + db.query(WalkInQueue).filter(WalkInQueue.customer_id == customer.customer_id).count()
        )
        if related_count > 0:
            blocked.append((customer, related_count))
        else:
            safe_to_delete.append(customer)

    if not safe_to_delete:
        names = "، ".join(
            f"{c.first_name} {c.last_name} ({count} سجل)" for c, count in blocked
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "لا يمكن الحذف النهائي — كل العملاء المحددين لديهم سجلات مرتبطة "
                f"(فواتير/مواعيد/إلخ): {names}. "
                "احتفظ بهم في الأرشيف أو احذف السجلات المرتبطة أولاً."
            ),
        )

    for customer in safe_to_delete:
        log = ActivityLog(
            user_id=current_user.id,
            action="permanent_delete",
            entity_type="customer",
            entity_id=customer.customer_id,
            description=f"حذف نهائي جماعي - العميل: {customer.first_name} {customer.last_name} (رقم: {customer.phone})"
        )
        db.add(log)
        db.delete(customer)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "فشل الحذف النهائي — بعض العملاء لديهم سجلات مرتبطة "
                "(فواتير، مواعيد، إلخ). "
                "احتفظ بهم في الأرشيف أو احذف السجلات المرتبطة أولاً."
            ),
        )

    # If we deleted some but not all, surface a clear partial-success message.
    if blocked:
        blocked_names = "، ".join(
            f"{c.first_name} {c.last_name}" for c, _ in blocked
        )
        return JSONResponse(
            status_code=status.HTTP_207_MULTI_STATUS,
            content={
                "deleted": [c.customer_id for c in safe_to_delete],
                "blocked": [{"id": c.customer_id, "name": f"{c.first_name} {c.last_name}", "related_records": count} for c, count in blocked],
                "detail": f"تم حذف {len(safe_to_delete)} عميل. تعذّر حذف {len(blocked)} عميل لوجود سجلات مرتبطة: {blocked_names}.",
            },
        )
    return None
