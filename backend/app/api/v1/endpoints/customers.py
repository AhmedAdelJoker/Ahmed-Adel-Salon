from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status, Body
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.sql import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.db.session import get_db
from app.api.deps import require_any_staff, require_owner, require_owner_or_manager
from app.models.user import User
from app.models.customer import Customer
from app.models.member_account import MemberAccount
from app.models.appointment import Appointment
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
from app.services.loyalty_service import sweep_expired_points
from app.core.pagination import PageParams, paginate
from app.core.audit import audit_log

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=list[CustomerRead])
def list_customers(
    response: Response = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    # Legacy params (kept for backward compatibility)
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    skip: Optional[int] = Query(None, ge=0),
    # Modern pagination — Phase 2
    page: int = Query(1, ge=1, le=10_000, description="1-indexed page"),
    size: int = Query(25, ge=1, le=500, description="Items per page"),
    sort: Optional[str] = Query(None, description="Sort field. '-' prefix for DESC"),
    # Filters
    q: Optional[str] = Query(None, max_length=100),
    segment: str = Query("all"),
):
    query = db.query(Customer).filter(Customer.is_deleted == False)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Customer.first_name.ilike(like),
                Customer.last_name.ilike(like),
                Customer.phone.ilike(like),
                Customer.email.ilike(like),
            )
        )
    seg = (segment or "all").lower()
    if seg == "vip":
        query = query.filter(Customer.visits_count > 10)
    elif seg == "regular":
        query = query.filter(Customer.visits_count.between(2, 10))
    elif seg == "new":
        query = query.filter(Customer.visits_count <= 1)

    # Phase 2: use PageParams for consistent envelope, but preserve legacy
    # `limit`/`offset`/`skip` behavior for callers that still use them.
    if page > 1 or size != 25:
        # Modern path — use paginate() helper
        params = PageParams(page=page, size=size, sort=sort)
        result = paginate(
            query, params,
            sort_columns={
                "id": Customer.customer_id,
                "name": Customer.first_name,
                "created_at": Customer.created_at,
                "visits_count": Customer.visits_count,
            },
        )
        if sweep_expired_points(db, list(result.items)):
            db.commit()
        if response is not None:
            response.headers["X-Total-Count"] = str(result.total)
            response.headers["X-Page"] = str(result.page)
            response.headers["X-Page-Size"] = str(result.size)
        return list(result.items)

    # Legacy path — preserve original behavior
    # `Query.count()` compiles to `SELECT count(*) FROM (SELECT <every mapped
    # column> ...) AS anon_1`, so it drags the whole row through a derived table
    # on every request. Replacing the projection with a bare count and dropping
    # the ORDER BY keeps the same filters without the subquery.
    total = query.with_entities(func.count()).order_by(None).scalar() or 0
    eff_offset = skip if skip is not None else max(offset, 0)
    eff_limit = max(1, min(limit, 1000))
    customers = (
        query.order_by(Customer.customer_id.desc())
        .offset(eff_offset)
        .limit(eff_limit)
        .all()
    )
    if sweep_expired_points(db, customers):
        db.commit()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
    return customers


@router.get("/stats")
def customers_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    """Aggregated customer stats (scales: no row fetching)."""
    base = db.query(Customer).filter(Customer.is_deleted == False)
    total = base.count()
    vip_count = base.filter(Customer.visits_count > 10).count()
    regular_count = base.filter(Customer.visits_count.between(2, 10)).count()
    new_count = base.filter(Customer.visits_count <= 1).count()
    avg_spend = base.with_entities(func.avg(Customer.lifetime_spend)).scalar()
    dup_rows = (
        db.query(Customer.phone, func.count(Customer.customer_id).label("cnt"))
        .filter(Customer.is_deleted == False)
        .filter(Customer.phone.isnot(None))
        .group_by(Customer.phone)
        .having(func.count(Customer.customer_id) > 1)
        .order_by(func.count(Customer.customer_id).desc())
        .limit(5000)
        .all()
    )
    return {
        "total": total,
        "vip_count": vip_count,
        "regular_count": regular_count,
        "new_count": new_count,
        "avg_spend": round(float(avg_spend or 0), 2),
        "duplicate_group_count": len(dup_rows),
        "duplicate_customer_count": sum(int(r.cnt) for r in dup_rows),
        "duplicates_truncated": len(dup_rows) >= 5000,
    }


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
    if sweep_expired_points(db, customers):
        db.commit()
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
    if sweep_expired_points(db, [customer]):
        db.commit()
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
    request: Request = None,
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

    # Archiving must also close the public-booking login. Rotating token_version
    # invalidates every member session that is already in the wild, so an
    # archived customer cannot keep using an access token they saved earlier.
    account = db.query(MemberAccount).filter(
        MemberAccount.customer_id == customer_id
    ).first()
    if account is not None:
        account.is_active = False
        account.token_version = int(account.token_version or 0) + 1
        db.add(account)

    # Log soft delete
    log = ActivityLog(
        user_id=current_user.id,
        action="soft_delete",
        entity_type="customer",
        entity_id=customer.customer_id,
        description=f"حذف ناعم للعميل: {customer.first_name} {customer.last_name} (رقم: {customer.phone}) - السبب: {archive_reason}"
    )
    db.add(log)

    if account is not None:
        db.add(
            ActivityLog(
                user_id=current_user.id,
                action="deactivate_member_account",
                entity_type="member_account",
                entity_id=customer.customer_id,
                description=f"تعطيل حساب العميل العام رقم {customer.customer_id} بسبب الأرشفة",
            )
        )

    db.commit()
    # Phase 2: the ActivityLog above has no IP/UA, so a leak can't be traced.
    # audit_log appends the forensic context as a separate, IP-stamped record.
    audit_log(
        db, request, current_user,
        action="soft_delete_customer",
        entity_type="customer",
        entity_id=customer_id,
        description={"archive_reason": archive_reason},
    )
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

    # Restoring is an explicit owner decision, so the public login comes back too.
    account = db.query(MemberAccount).filter(
        MemberAccount.customer_id == customer_id
    ).first()
    if account is not None and not account.is_active:
        account.is_active = True
        account.token_version = int(account.token_version or 0) + 1
        db.add(account)
        db.add(
            ActivityLog(
                user_id=current_user.id,
                action="activate_member_account",
                entity_type="member_account",
                entity_id=customer.customer_id,
                description=f"إعادة تفعيل حساب العميل العام رقم {customer.customer_id} بعد الاستعادة",
            )
        )

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
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Permanently delete a customer (GDPR compliance). Owner only.
    Note: This will fail if customer has related invoices/appointments due to FK constraints.
    """
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    # Snapshot before delete — after `db.delete()` the ORM state is expunged,
    # so this is the last chance to record what was destroyed.
    snapshot = {
        "name": f"{customer.first_name} {customer.last_name}".strip(),
        "phone": customer.phone,
    }

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
    audit_log(
        db, request, current_user,
        action="permanent_delete_customer",
        entity_type="customer",
        entity_id=customer_id,
        description={"destroyed": snapshot},
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


# Every table that keeps a customer alive. A customer with a row in any of them
# cannot be hard-deleted, so the bulk delete has to count all six.
RELATED_COUNT_SOURCES = (
    (Appointment, Appointment.customer_id),
    (Invoice, Invoice.customer_id),
    (ServiceSession, ServiceSession.customer_id),
    (CustomerCancellationLog, CustomerCancellationLog.customer_id),
    (WaitlistEntry, WaitlistEntry.customer_id),
    (WalkInQueue, WalkInQueue.customer_id),
)


def counts_by_customer(db, model, column, customer_ids: list[int]) -> dict[int, int]:
    """One grouped query for a whole set of customers.

    The alternative is a `count()` per customer per table, which is six times
    the number of customers. Deleting fifty customers meant three hundred round
    trips before the delete began — and the answer was the same shape of
    question every time.
    """
    if not customer_ids:
        return {}
    rows = (
        db.query(column, func.count(model.id))
        .filter(column.in_(customer_ids))
        .group_by(column)
        .all()
    )
    return {key: count for key, count in rows}


@router.delete("/archive/bulk-permanent", status_code=status.HTTP_204_NO_CONTENT)
def bulk_permanent_delete_customers(
    customer_ids: list[int] = Body(..., embed=True),
    request: Request = None,
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
    #
    # One grouped query per table rather than six counts per customer. The
    # original loop issued 6 × N queries, so deleting 50 customers meant 300
    # round trips before the delete even started, and the answer was the same
    # shape of question for every table.
    related_by_customer: dict[int, int] = {c.customer_id: 0 for c in customers}

    for model, column in RELATED_COUNT_SOURCES:
        for key, count in counts_by_customer(db, model, column, [c.customer_id for c in customers]).items():
            related_by_customer[key] = related_by_customer.get(key, 0) + count

    blocked = []
    safe_to_delete = []
    for customer in customers:
        related_count = related_by_customer.get(customer.customer_id, 0)
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

    # Snapshot of what was actually destroyed — `safe_to_delete` rows are
    # expunged after commit, so the names must be captured first.
    destroyed = [
        {"id": c.customer_id, "name": f"{c.first_name} {c.last_name}".strip(), "phone": c.phone}
        for c in safe_to_delete
    ]
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

    audit_log(
        db, request, current_user,
        action="bulk_permanent_delete_customers",
        entity_type="customer",
        description={
            "deleted_count": len(destroyed),
            "blocked_count": len(blocked),
            "destroyed": destroyed,
        },
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
