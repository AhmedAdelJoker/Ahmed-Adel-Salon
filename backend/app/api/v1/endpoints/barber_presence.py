from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime

from app.db.session import get_db
from app.api.deps import require_any_staff, require_barber_only, require_cashier_manager_owner
from app.models.user import User
from app.models.barber import Barber
from app.models.barber_presence_log import BarberPresenceLog
from app.schemas.barber_presence import BarberPresenceRead

router = APIRouter(prefix="/barber-presence", tags=["Barber Presence"])


def _serialize_presence(row: BarberPresenceLog) -> BarberPresenceRead:
    return BarberPresenceRead(
        id=row.id,
        barber_id=row.barber_id,
        barber_name=row.barber.display_name if row.barber else f"Barber #{row.barber_id}",
        status=row.status,
        created_at=row.created_at
    )


@router.get("/logs", response_model=list[BarberPresenceRead])
def get_presence_logs(
    limit: int = Query(100, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff)
):
    rows = (
        db.query(BarberPresenceLog)
        .options(joinedload(BarberPresenceLog.barber))
        .order_by(BarberPresenceLog.id.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_presence(row) for row in rows]


@router.post("/register")
def manual_register(
    employee_id: int = Query(...),
    status_type: str = Query(...),
    timestamp: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner)
):
    """
    تسجيل يدوي للحضور والانصراف من قبل المدير أو الكاشير
    """
    barber = db.query(Barber).filter(Barber.id == employee_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    dt = datetime.fromisoformat(timestamp) if timestamp else datetime.now()
    
    log = BarberPresenceLog(
        barber_id=employee_id,
        status=status_type,
        created_at=dt
    )
    db.add(log)
    db.commit()
    return {"message": "تم تسجيل العملية بنجاح"}


@router.post("/check-in")
def barber_check_in(db: Session = Depends(get_db), current_user: User = Depends(require_barber_only)):
    if not current_user.barber_id:
        raise HTTPException(status_code=400, detail="هذا المستخدم غير مربوط بحلاق")
    db.add(BarberPresenceLog(barber_id=current_user.barber_id, status="in"))
    db.commit()
    return {"message": "تم تسجيل الحضور"}

@router.post("/check-out")
def barber_check_out(db: Session = Depends(get_db), current_user: User = Depends(require_barber_only)):
    if not current_user.barber_id:
        raise HTTPException(status_code=400, detail="هذا المستخدم غير مربوط بحلاق")
    db.add(BarberPresenceLog(barber_id=current_user.barber_id, status="out"))
    db.commit()
    return {"message": "تم تسجيل الانصراف"}

@router.get("/current", response_model=list[BarberPresenceRead])
def get_current_presence(db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    rows = db.query(BarberPresenceLog).order_by(BarberPresenceLog.id.desc()).all()
    latest_per_barber = {}
    for row in rows:
        if row.barber_id not in latest_per_barber:
            latest_per_barber[row.barber_id] = row
    return list(latest_per_barber.values())
