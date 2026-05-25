from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_any_staff, require_cashier_manager_owner
from app.models.user import User
from app.models.customer import Customer
from app.models.barber import Barber
from app.models.appointment import Appointment
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


def _serialize_session(db: Session, session: ServiceSession) -> ServiceSessionRead:
    customer = db.query(Customer).filter(Customer.customer_id == session.customer_id).first()
    barber = db.query(Barber).filter(Barber.id == session.barber_id).first()

    return ServiceSessionRead(
        id=session.id,
        appointment_id=session.appointment_id,
        customer_id=session.customer_id,
        barber_id=session.barber_id,
        status=session.status,
        notes=session.notes,
        total_price=session.total_price,
        created_by_user_id=session.created_by_user_id,
        created_at=session.created_at,
        customer_name=(
            f"{customer.first_name or ''} {customer.last_name or ''}".strip()
            if customer else None
        ),
        barber_name=barber.display_name if barber else None,
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

    if current_user.role == "barber" and current_user.barber_id:
        query = query.filter(ServiceSession.barber_id == current_user.barber_id)

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

    if current_user.role == "barber" and current_user.barber_id != session_row.barber_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذه الجلسة")

    return _serialize_session(db, session_row)


@router.post("", response_model=ServiceSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    if payload.appointment_id:
        appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="الحجز غير موجود")

        session_row = create_session_from_appointment(
            db,
            appointment=appointment,
            created_by_user_id=current_user.id,
            notes=payload.notes,
        )
    else:
        session_row = create_manual_session(
            db,
            customer_id=payload.customer_id,
            barber_id=payload.barber_id,
            appointment_id=None,
            notes=payload.notes,
            created_by_user_id=current_user.id,
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

    if current_user.role == "barber" and current_user.barber_id != session_row.barber_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لهذه الجلسة")

    session_row.status = payload.status
    db.commit()
    db.refresh(session_row)

    session_row = (
        db.query(ServiceSession)
        .options(joinedload(ServiceSession.products))
        .filter(ServiceSession.id == session_id)
        .first()
    )

    return _serialize_session(db, session_row)
