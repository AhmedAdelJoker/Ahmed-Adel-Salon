from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_any_staff, require_barber_only
from app.models.user import User
from app.models.barber_presence_log import BarberPresenceLog
from app.schemas.barber_presence import BarberPresenceRead

router = APIRouter(prefix="/barber-presence", tags=["Barber Presence"])

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
