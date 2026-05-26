from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.customer_names import compose_customer_name
from app.db.session import get_db
from app.api.deps import require_any_staff
from app.models.user import User
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.appointment import Appointment
from app.models.pos_shift import PosShift
from app.models.service import Service
from app.models.service_session import ServiceSession

from app.schemas.service_session import (
    SessionCreate,
    SessionStatusUpdate,
    ServiceSessionRead,
)
from app.services.session_service import (
    create_manual_session,
    create_session_from_appointment,
)

router = APIRouter(prefix="/sessions", tags=["Service Sessions"])


def _get_open_shift_for_user(db: Session, user_id: int | None) -> PosShift | None:
    if not user_id:
        return None
    return (
        db.query(PosShift)
        .filter(PosShift.cashier_user_id == user_id, PosShift.status == "open")
        .order_by(PosShift.id.desc())
        .first()
    )


def _serialize_session(db: Session, session: ServiceSession) -> ServiceSessionRead:
    customer = db.query(Customer).filter(Customer.customer_id == session.customer_id).first()
    employee = db.query(Employee).filter(Employee.id == session.employee_id).first()
    service = db.query(Service).filter(Service.id == session.service_id).first()

    return ServiceSessionRead(
        id=session.id,
        appointment_id=session.appointment_id,
        customer_id=session.customer_id,
        barber_id=session.employee_id, # Compatibility
        employee_id=session.employee_id,
        service_id=session.service_id,
        status=session.status,
        notes=session.notes,
        total_price=session.total_price,
        created_by_user_id=session.created_by_user_id,
        created_at=session.created_at,
        customer_name=(
            compose_customer_name(customer.first_name, customer.last_name)
            if customer else None
        ),
        barber_name=employee.display_name if employee else (employee.full_name if employee else None),
        service_name=service.name if service else None,
        products=session.products or [],
    )


@router.get("", response_model=list[ServiceSessionRead])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    query = (
        db.query(ServiceSession)
        .options(joinedload(ServiceSession.products))
        .order_by(ServiceSession.id.desc())
    )

    if current_user.role == "barber" and current_user.employee_id:
        query = query.filter(ServiceSession.employee_id == current_user.employee_id)

    rows = query.all()
    return [_serialize_session(db, row) for row in rows]


@router.get("/{session_id}", response_model=ServiceSessionRead)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    session_row = (
        db.query(ServiceSession)
        .options(joinedload(ServiceSession.products))
        .filter(ServiceSession.id == session_id)
        .first()
    )
    if not session_row:
        raise HTTPException(status_code=404, detail="الجلسة غير موجودة")

    if current_user.role == "barber" and current_user.employee_id != session_row.employee_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذه الجلسة")

    return _serialize_session(db, session_row)


@router.post("", response_model=ServiceSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    if payload.appointment_id:
        appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="الحجز غير موجود")

        if current_user.role == "barber" and current_user.employee_id != appointment.employee_id:
            raise HTTPException(status_code=403, detail="ليس لديك صلاحية لبدء هذه الخدمة")

        if appointment.shift_id:
            shift = db.query(PosShift).filter(PosShift.id == appointment.shift_id).first()
            if shift and shift.status != "open":
                raise HTTPException(status_code=403, detail="لا يمكن تشغيل جلسة لحجز موجود داخل وردية مغلقة")

        open_shift = _get_open_shift_for_user(db, getattr(current_user, "id", None))
        if appointment.shift_id is None and open_shift:
            appointment.shift_id = open_shift.id
            db.add(appointment)

        session_row = create_session_from_appointment(
            db,
            appointment=appointment,
            created_by_user_id=current_user.id,
            notes=payload.notes,
        )
    else:
        if current_user.role == "barber":
            raise HTTPException(
                status_code=403,
                detail="الحلاق لا يمكنه إنشاء جلسة يدوية بدون حجز",
            )
        open_shift = _get_open_shift_for_user(db, getattr(current_user, "id", None))
        
        target_employee_id = payload.employee_id or payload.barber_id

        session_row = create_manual_session(
            db,
            customer_id=payload.customer_id,
            employee_id=target_employee_id,
            service_id=payload.service_id,
            appointment_id=None,
            notes=payload.notes,
            created_by_user_id=current_user.id,
            shift_id=open_shift.id if open_shift else None,
        )

    db.commit()
    db.refresh(session_row)

    session_row = (
        db.query(ServiceSession)
        .options(joinedload(ServiceSession.products))
        .filter(ServiceSession.id == session_row.id)
        .first()
    )

    return _serialize_session(db, session_row)


@router.patch("/{session_id}/status", response_model=ServiceSessionRead)
def update_session_status(
    session_id: int,
    payload: SessionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    session_row = db.query(ServiceSession).filter(ServiceSession.id == session_id).first()
    if not session_row:
        raise HTTPException(status_code=404, detail="الجلسة غير موجودة")

    if current_user.role == "barber" and current_user.employee_id != session_row.employee_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذه الجلسة")

    if session_row.shift_id:
        shift = db.query(PosShift).filter(PosShift.id == session_row.shift_id).first()
        if shift and shift.status != "open":
            raise HTTPException(status_code=403, detail="لا يمكن تعديل جلسة داخل وردية مغلقة")

    session_row.status = payload.status
    if session_row.appointment_id:
        appointment = db.query(Appointment).filter(Appointment.id == session_row.appointment_id).first()
        if appointment:
            if payload.status == "active":
                appointment.status = "in_progress"
                appointment.checked_in_at = appointment.checked_in_at or datetime.utcnow()
                db.add(appointment)
            elif payload.status == "completed":
                appointment.status = "waiting_payment"
                appointment.completed_at = appointment.completed_at or datetime.utcnow()
                db.add(appointment)
            elif payload.status == "cancelled":
                appointment.status = "cancelled"
                appointment.cancelled_at = appointment.cancelled_at or datetime.utcnow()
                db.add(appointment)
    db.commit()
    db.refresh(session_row)

    session_row = (
        db.query(ServiceSession)
        .options(joinedload(ServiceSession.products))
        .filter(ServiceSession.id == session_id)
        .first()
    )

    return _serialize_session(db, session_row)



