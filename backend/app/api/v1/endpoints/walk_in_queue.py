from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import require_cashier_manager_owner, get_current_active_shift
from app.core.customer_names import compose_customer_name
from app.db.session import get_db
from app.models.customer import Customer
from app.models.user import User
from app.models.walk_in_queue import WalkInQueue
from app.models.pos_shift import PosShift
from app.models.service_session import ServiceSession
from app.schemas.walk_in_queue import WalkInQueueAssign, WalkInQueueCreate
from app.services.activity_service import log_activity
from app.services.session_service import convert_queue_to_session

router = APIRouter(prefix="/walk-in-queue", tags=["Walk-in Queue"])


def _serialize_queue_item(db: Session, row: WalkInQueue):
    cust_name = (
        compose_customer_name(row.customer.first_name, row.customer.last_name)
        if row.customer
        else "Unknown"
    )
    return {
        "id": row.id,
        "customer_id": row.customer_id,
        "customer_name": cust_name,
        "ticket_no": row.ticket_no,
        "service_name": row.service.name if row.service else None,
        "requested_barber_name": (
            row.requested_employee.display_name if row.requested_employee else None
        ),
        "assigned_barber_name": (
            row.assigned_employee.display_name if row.assigned_employee else None
        ),
        "status": row.status,
        "estimated_wait_minutes": row.estimated_wait_minutes,
        "arrived_at": row.arrived_at,
        "shift_id": row.shift_id
    }


def _ensure_queue_customer(db: Session, payload: WalkInQueueCreate) -> Customer:
    if payload.customer_id is not None:
        customer = (
            db.query(Customer)
            .filter(Customer.customer_id == payload.customer_id)
            .first()
        )
        if not customer:
            raise HTTPException(status_code=404, detail="العميل غير موجود")
        return customer

    if not payload.customer_phone or not payload.customer_first_name:
        raise HTTPException(
            status_code=400,
            detail="الاسم ورقم الهاتف مطلوبان لإضافة عميل جديد إلى الطابور",
        )

    customer = (
        db.query(Customer)
        .filter(Customer.phone == payload.customer_phone.strip())
        .first()
    )
    if customer:
        customer.first_name = payload.customer_first_name.strip()
        customer.last_name = (payload.customer_last_name or "").strip()
        customer.notes = payload.queue_note or customer.notes
        db.add(customer)
        db.flush()
        return customer

    customer = Customer(
        first_name=payload.customer_first_name.strip(),
        last_name=(payload.customer_last_name or "").strip(),
        phone=payload.customer_phone.strip(),
        email=payload.customer_email,
        notes=payload.queue_note,
    )
    db.add(customer)
    db.flush()
    return customer


@router.get("")
def list_queue(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    skip: int = Query(0, ge=0),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=500),
    sort: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    # Phase 2: was returning ALL queue items unbounded
    query = db.query(WalkInQueue).filter(
        WalkInQueue.status.in_(["waiting", "called", "in_service"])
    )

    if sort:
        sort_field = sort.lstrip("-")
        desc = sort.startswith("-")
        column = getattr(WalkInQueue, sort_field, None)
        if column is not None:
            query = query.order_by(column.desc() if desc else column.asc())
    else:
        query = query.order_by(WalkInQueue.id.asc())

    eff_offset = offset
    eff_limit = limit
    if page is not None and page_size is not None:
        eff_offset = (page - 1) * page_size
        eff_limit = page_size
    elif skip > 0:
        eff_offset = skip

    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)
    rows = query.offset(eff_offset).limit(eff_limit).all()
    return [_serialize_queue_item(db, r) for r in rows]


@router.post("")
def add_to_queue(
    payload: WalkInQueueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
    active_shift: PosShift = Depends(get_current_active_shift)
):
    # ERP Rule: Walk-ins must happen during an active shift
    count = db.query(WalkInQueue).count() + 1
    ticket_no = f"T-{count:03d}"
    customer = _ensure_queue_customer(db, payload)
    
    row = WalkInQueue(
        customer_id=customer.customer_id,
        service_id=payload.service_id,
        requested_employee_id=payload.requested_barber_id,
        assigned_employee_id=payload.assigned_barber_id,
        ticket_no=ticket_no,
        status="waiting",
        queue_note=payload.queue_note,
        estimated_wait_minutes=payload.estimated_wait_minutes,
        shift_id=active_shift.id,
        created_by_user_id=current_user.id
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_queue_item(db, row)


@router.post("/{queue_id}/convert")
def convert_to_session_route(
    queue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    row = db.query(WalkInQueue).filter(WalkInQueue.id == queue_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    if row.status == "converted":
        raise HTTPException(status_code=400, detail="Already converted")

    # Link session to the same shift
    session = convert_queue_to_session(db, queue_id, current_user.id)
    session.shift_id = row.shift_id
    
    row.status = "converted"
    row.converted_session_id = session.id
    
    log_activity(
        db,
        user_id=current_user.id,
        action="walk_in_converted",
        entity_type="walk_in_queue",
        entity_id=row.id,
        description=f"Walk-in ticket {row.ticket_no} converted to session {session.id}",
    )
    db.commit()
    db.refresh(row)
    return {
        "queue": _serialize_queue_item(db, row),
        "session_id": session.id,
    }


@router.patch("/{queue_id}/call")
def call_queue_ticket(
    queue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    row = db.query(WalkInQueue).filter(WalkInQueue.id == queue_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Queue item not found")
    if row.status not in {"waiting", "called"}:
        raise HTTPException(status_code=400, detail="لا يمكن نداء هذه التذكرة في حالتها الحالية")

    row.status = "called"
    row.called_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_queue_item(db, row)


@router.patch("/{queue_id}/assign")
def assign_queue_ticket(
    queue_id: int,
    payload: WalkInQueueAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    row = db.query(WalkInQueue).filter(WalkInQueue.id == queue_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Queue item not found")
    if row.status in {"converted", "cancelled"}:
        raise HTTPException(status_code=400, detail="لا يمكن تعديل تذكرة مؤرشفة أو ملغاة")

    row.assigned_employee_id = payload.assigned_barber_id
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_queue_item(db, row)


@router.patch("/{queue_id}/cancel")
def cancel_queue_ticket(
    queue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    row = db.query(WalkInQueue).filter(WalkInQueue.id == queue_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Queue item not found")
    if row.status == "converted":
        raise HTTPException(status_code=400, detail="لا يمكن إلغاء تذكرة تم تحويلها إلى جلسة")

    row.status = "cancelled"
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_queue_item(db, row)


@router.post("/{queue_id}/start-service")
def start_queue_service(
    queue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    row = db.query(WalkInQueue).filter(WalkInQueue.id == queue_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Queue item not found")
    if row.status in {"converted", "cancelled"}:
        raise HTTPException(status_code=400, detail="لا يمكن بدء الخدمة لهذه التذكرة")

    row.status = "in_service"
    row.service_started_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_queue_item(db, row)



