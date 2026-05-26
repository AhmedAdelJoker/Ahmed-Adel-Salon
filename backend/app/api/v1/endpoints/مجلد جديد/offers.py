from fastapi.middleware.cors import CORSMiddleware
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.offer import Offer, OfferService
from app.schemas.offer import OfferCreate, OfferUpdate, OfferRead, OfferServiceBase
from app.models.service import Service
from app.models.user import User
from app.api.deps import require_owner

router = APIRouter(prefix="/offers", tags=["Offers"])


@router.get("", response_model=list[OfferRead])
def list_offers(db: Session = Depends(get_db)):
    return db.query(Offer).order_by(Offer.id.desc()).all()


@router.get("/active", response_model=list[OfferRead])
def list_active_offers(db: Session = Depends(get_db)):
    today = date.today()
    return (
        db.query(Offer)
        .filter(Offer.is_active == True)
        .filter((Offer.start_date == None) | (Offer.start_date <= today))
        .filter((Offer.end_date == None) | (Offer.end_date >= today))
        .order_by(Offer.id.desc())
        .all()
    )


@router.get("/{offer_id}", response_model=OfferRead)
def get_offer(offer_id: int, db: Session = Depends(get_db)):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")
    return offer


@router.post("", response_model=OfferRead, status_code=status.HTTP_201_CREATED)
def create_offer(payload: OfferCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    offer_data = payload.model_dump(exclude={"services"})
    
    offer = Offer(**offer_data)
    db.add(offer)
    db.flush()
    
    for svc_item in payload.services:
        service = db.query(Service).filter(Service.id == svc_item.service_id).first()
        if service:
            db.add(OfferService(offer_id=offer.id, service_id=svc_item.service_id, quantity=svc_item.quantity))
    
    db.commit()
    db.refresh(offer)
    return offer


@router.put("/{offer_id}", response_model=OfferRead)
def update_offer(offer_id: int, payload: OfferUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")
    
    update_data = payload.model_dump(exclude_unset=True, exclude={"services"})
    for field, value in update_data.items():
        setattr(offer, field, value)
    
    if payload.services is not None:
        db.query(OfferService).filter(OfferService.offer_id == offer.id).delete()
        for svc_item in payload.services:
            service = db.query(Service).filter(Service.id == svc_item.service_id).first()
            if service:
                db.add(OfferService(offer_id=offer.id, service_id=svc_item.service_id, quantity=svc_item.quantity))
    
    db.commit()
    db.refresh(offer)
    return offer


@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_offer(offer_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")
    db.delete(offer)
    db.commit()
    return None


@router.patch("/{offer_id}/toggle-active", response_model=OfferRead)
def toggle_offer_active(offer_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")
    offer.is_active = not offer.is_active
    db.commit()
    db.refresh(offer)
    return offer



