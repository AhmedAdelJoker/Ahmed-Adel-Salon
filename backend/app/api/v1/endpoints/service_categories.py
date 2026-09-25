from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_any_staff, require_manage_catalog
from app.db.session import get_db
from app.models.service import Service
from app.models.service_category import ServiceCategory
from app.models.user import User
from app.schemas.service_category import (
    ServiceCategoryCreate,
    ServiceCategoryRead,
    ServiceCategoryUpdate,
)

router = APIRouter(prefix="/service-categories", tags=["Service Categories"])


@router.get("", response_model=list[ServiceCategoryRead])
def list_service_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    return (
        db.query(ServiceCategory)
        .order_by(ServiceCategory.sort_order.asc(), ServiceCategory.id.asc())
        .all()
    )


@router.get("/{category_id}", response_model=ServiceCategoryRead)
def get_service_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")
    return category


@router.post("", response_model=ServiceCategoryRead, status_code=status.HTTP_201_CREATED)
def create_service_category(
    payload: ServiceCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_catalog),
):
    category = ServiceCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=ServiceCategoryRead)
def update_service_category(
    category_id: int,
    payload: ServiceCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_catalog),
):
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")

    for field, value in payload.model_dump().items():
        setattr(category, field, value)

    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}/toggle-active", response_model=ServiceCategoryRead)
def toggle_service_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_catalog),
):
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")

    category.is_active = not bool(category.is_active)
    db.add(category)

    services = db.query(Service).filter(Service.category_id == category.id).all()
    for service in services:
        service.is_active = category.is_active
        db.add(service)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_catalog),
):
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")

    services = db.query(Service).filter(Service.category_id == category.id).all()
    for service in services:
        service.category_id = None
        service.category = None
        db.add(service)

    db.delete(category)
    db.commit()
    return None
