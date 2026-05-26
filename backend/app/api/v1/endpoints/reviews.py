from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_any_staff
from app.models.appointment import Appointment
from app.models.review import Review
from app.models.user import User
from app.db.session import get_db
from app.schemas.review import ReviewCreate, ReviewRead

router = APIRouter(prefix="/reviews", tags=["Reviews & Ratings"])


@router.get("", response_model=List[ReviewRead])
def list_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    barber_id: int | None = None,
    limit: int = 20,
):
    query = db.query(Review).order_by(Review.created_at.desc())

    if current_user.role == "barber":
        target_barber_id = current_user.barber_id
        if not target_barber_id:
            return []
        query = query.filter(Review.barber_id == target_barber_id)
    elif barber_id is not None:
        query = query.filter(Review.barber_id == barber_id)

    return query.limit(limit).all()


@router.get("/public", response_model=List[ReviewRead])
def list_public_reviews(db: Session = Depends(get_db), limit: int = 10):
    return (
        db.query(Review)
        .filter(Review.is_public == True)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .all()
    )

@router.post("", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
def create_review(payload: ReviewCreate, db: Session = Depends(get_db)):
    # If appointment_id is provided, ensure it's not already reviewed
    if payload.appointment_id:
        existing = db.query(Review).filter(Review.appointment_id == payload.appointment_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="هذا الموعد تم تقييمه بالفعل")
            
        appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
        if appointment:
            # Auto-assign barber and customer from appointment
            review = Review(
                **payload.model_dump(),
                customer_id=appointment.customer_id,
                barber_id=appointment.barber_id,
                is_verified_visit=True
            )
            db.add(review)
            db.commit()
            db.refresh(review)
            return review

    # Fallback for general review
    review = Review(**payload.model_dump(), is_verified_visit=False)
    db.add(review)
    db.commit()
    db.refresh(review)
    return review



