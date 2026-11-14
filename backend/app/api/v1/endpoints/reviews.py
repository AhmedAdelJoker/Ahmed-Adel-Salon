from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_any_staff
from app.core.config import settings
from app.core.rate_limit import rate_limit
from app.models.appointment import Appointment
from app.models.review import Review
from app.models.user import User
from app.db.session import get_db
from app.schemas.review import ReviewCreate, ReviewRead

router = APIRouter(prefix="/reviews", tags=["Reviews & Ratings"])


def _serialize_review(review: Review) -> ReviewRead:
    return ReviewRead(
        id=review.id,
        rating=review.rating,
        comment=review.comment,
        customer_name_snapshot=review.customer_name_snapshot,
        is_public=review.is_public,
        is_verified_visit=review.is_verified_visit,
        created_at=review.created_at,
        employee_id=review.employee_id,
        barber_id=review.employee_id,
    )


@router.get("", response_model=List[ReviewRead])
def list_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    barber_id: int | None = None,
    limit: int = 20,
):
    query = db.query(Review).order_by(Review.created_at.desc())

    if current_user.role == "barber":
        target_employee_id = current_user.barber_id or current_user.employee_id
        if not target_employee_id:
            return []
        query = query.filter(Review.employee_id == target_employee_id)
    elif barber_id is not None:
        query = query.filter(Review.employee_id == barber_id)

    return [_serialize_review(review) for review in query.limit(limit).all()]


@router.get("/public", response_model=List[ReviewRead])
def list_public_reviews(db: Session = Depends(get_db), limit: int = 10):
    reviews = (
        db.query(Review)
        .filter(Review.is_public == True)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_review(review) for review in reviews]

@router.post(
    "",
    response_model=ReviewRead,
    status_code=status.HTTP_201_CREATED,
    # Deliberately reachable without a session -- a customer leaves a review from
    # the public site and has no account to log in with. What that needs is a
    # quota, not an identity: unauthenticated and unmetered, this endpoint is a
    # table anyone can grow from the internet, and the audit reports it as
    # UNPROTECTED by design rather than by oversight. Its own bucket, so the
    # public-booking quota is not spent by it and vice versa.
    dependencies=[
        Depends(
            rate_limit(
                "public_review_create",
                max_requests=settings.PUBLIC_RATE_LIMIT_MAX_REQUESTS,
                window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
def create_review(payload: ReviewCreate, db: Session = Depends(get_db)):
    review_data = payload.model_dump(exclude={"barber_id"})
    if payload.appointment_id:
        existing = (
            db.query(Review)
            .filter(Review.appointment_id == payload.appointment_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="هذا الموعد تم تقييمه بالفعل")

        appointment = (
            db.query(Appointment)
            .filter(Appointment.id == payload.appointment_id)
            .first()
        )
        if not appointment:
            raise HTTPException(status_code=404, detail="الموعد غير موجود")
        if appointment.status not in {"completed", "done", "checked_out", "paid"}:
            raise HTTPException(status_code=400, detail="يمكن تقييم الموعد بعد اكتماله فقط")

        review = Review(
            **review_data,
            customer_id=appointment.customer_id,
            employee_id=appointment.barber_id,
            is_verified_visit=True,
        )
    else:
        review = Review(
            **review_data,
            employee_id=payload.barber_id,
            is_verified_visit=False,
        )

    db.add(review)
    db.commit()
    db.refresh(review)
    return _serialize_review(review)



