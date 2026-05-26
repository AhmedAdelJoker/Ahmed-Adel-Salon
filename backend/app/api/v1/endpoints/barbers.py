from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_any_staff
from app.models.user import User
from app.models.barber import Barber
from app.schemas.barber import BarberCreate, BarberRead, BarberUpdate

router = APIRouter(prefix="/barbers", tags=["Barbers"])


@router.get("", response_model=list[BarberRead])
def list_barbers(
    limit: int = Query(100, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    return db.query(Barber).order_by(Barber.id.desc()).offset(offset).limit(limit).all()


@router.post("/upload-image")
def upload_barber_image(
    current_user: User = Depends(require_any_staff),
):
    """
    Stub for image upload
    """
    return {"message": "Image uploaded successfully (Stub)", "url": "/uploads/profiles/default.png"}


@router.get("/{barber_id}", response_model=BarberRead)
def get_barber(
    barber_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    barber = db.query(Barber).filter(Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")
    return barber


@router.post("", response_model=BarberRead, status_code=status.HTTP_201_CREATED)
def create_barber(
    payload: BarberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    barber = Barber(display_name=payload.display_name)
    db.add(barber)
    db.commit()
    db.refresh(barber)
    return barber


@router.put("/{barber_id}", response_model=BarberRead)
def update_barber(
    barber_id: int,
    payload: BarberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    barber = db.query(Barber).filter(Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")

    barber.display_name = payload.display_name
    db.commit()
    db.refresh(barber)
    return barber


@router.delete("/{barber_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_barber(
    barber_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    barber = db.query(Barber).filter(Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="الحلاق غير موجود")

    db.delete(barber)
    db.commit()
    return None
