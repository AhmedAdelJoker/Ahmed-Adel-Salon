from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.service_category import ServiceCategory
from app.schemas.service_category import ServiceCategoryCreate, ServiceCategoryUpdate, ServiceCategoryRead
from app.models.user import User
from app.api.deps import require_owner

router = APIRouter(prefix="/service-categories", tags=["Service Categories"])


@router.get("", response_model=list[ServiceCategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return db.query(ServiceCategory).order_by(ServiceCategory.sort_order.asc(), ServiceCategory.id.asc()).all()


@router.get("/{category_id}", response_model=ServiceCategoryRead)
def get_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")
    return cat


@router.post("", response_model=ServiceCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: ServiceCategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    cat = ServiceCategory(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=ServiceCategoryRead)
def update_category(category_id: int, payload: ServiceCategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")
    db.delete(cat)
    db.commit()
    return None


@router.patch("/{category_id}/toggle-active", response_model=ServiceCategoryRead)
def toggle_category_active(category_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")
    cat.is_active = not cat.is_active
    db.commit()
    db.refresh(cat)
    return cat



