from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_any_staff, require_owner
from app.db.session import get_db
from app.models.service import Service
from app.models.service_category import ServiceCategory
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter(prefix="/services", tags=["Services"])


def _serialize_service(service: Service) -> ServiceRead:
    category = None
    if service.category_rel:
        category = service.category_rel.name_ar or service.category_rel.name

    ingredients = []
    if hasattr(service, "service_products") and service.service_products:
        for sp in service.service_products:
            ingredients.append({
                "id": sp.id,
                "product_id": sp.product_id,
                "amount_used": sp.amount_used,
                "product": sp.product
            })

    return ServiceRead.model_validate(
        {
            "id": service.id,
            "name": service.name,
            "name_ar": service.name_ar,
            "name_en": service.name_en,
            "category": category,
            "category_id": service.category_id,
            "description_ar": service.description_ar,
            "price": service.price,
            "duration_minutes": service.duration_minutes,
            "is_bookable_online": service.is_bookable_online,
            "is_pos_enabled": service.is_pos_enabled,
            "requires_specific_barber": service.requires_specific_barber,
            "display_order": service.display_order,
            "is_active": service.is_active,
            "created_at": service.created_at,
            "ingredients": ingredients
        }
    )


def _resolve_category_id(
    db: Session,
    category_id: int | None,
    category_name: str | None,
) -> int | None:
    if category_id is not None:
        category = (
            db.query(ServiceCategory)
            .filter(ServiceCategory.id == category_id)
            .first()
        )
        if not category:
            raise HTTPException(status_code=404, detail="التصنيف المحدد غير موجود")
        return category.id

    if not category_name:
        return None

    normalized_name = category_name.strip()
    if not normalized_name:
        return None

    category = (
        db.query(ServiceCategory)
        .filter(
            or_(
                ServiceCategory.name == normalized_name,
                ServiceCategory.name_ar == normalized_name,
            )
        )
        .first()
    )

    return category.id if category else None


@router.get("")
def list_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=5000),
    page: int | None = Query(default=None, ge=1),
    page_size: int | None = Query(default=None, ge=1, le=5000),
    q: str | None = None,
    category_id: int | None = None,
    is_active: bool | None = None,
):
    del current_user

    if page is not None:
        resolved_page_size = page_size or limit
        skip = (page - 1) * resolved_page_size
        limit = resolved_page_size
    elif page_size is not None:
        limit = page_size

    query = db.query(Service).options(joinedload(Service.category_rel))

    if q:
        search = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Service.name.ilike(search),
                Service.name_ar.ilike(search),
                Service.name_en.ilike(search),
                Service.description_ar.ilike(search),
            )
        )

    if category_id is not None:
        query = query.filter(Service.category_id == category_id)

    if is_active is not None:
        query = query.filter(Service.is_active == is_active)

    total = query.count()
    items = (
        query.order_by(Service.display_order.asc(), Service.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": [_serialize_service(service) for service in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{service_id}", response_model=ServiceRead)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    del current_user

    service = (
        db.query(Service)
        .options(joinedload(Service.category_rel))
        .filter(Service.id == service_id)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")

    return _serialize_service(service)


from app.models.service_product import ServiceProduct

@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    del current_user

    payload_data = payload.model_dump()
    resolved_category_id = _resolve_category_id(
        db,
        payload_data.get("category_id"),
        payload_data.get("category"),
    )

    ingredients = payload_data.pop("ingredients", None)
    payload_data["category_id"] = resolved_category_id
    payload_data.pop("category", None)

    service = Service(**payload_data)
    db.add(service)
    db.flush()

    if ingredients:
        for ing in ingredients:
            sp = ServiceProduct(
                service_id=service.id,
                product_id=ing["product_id"],
                amount_used=ing["amount_used"]
            )
            db.add(sp)

    db.commit()
    db.refresh(service)

    service = (
        db.query(Service)
        .options(joinedload(Service.category_rel), joinedload(Service.service_products).joinedload(ServiceProduct.product))
        .filter(Service.id == service.id)
        .first()
    )
    return _serialize_service(service)


@router.put("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    del current_user

    service = (
        db.query(Service)
        .options(joinedload(Service.category_rel))
        .filter(Service.id == service_id)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")

    update_data = payload.model_dump(exclude_unset=True)
    if "category_id" in update_data or "category" in update_data:
        update_data["category_id"] = _resolve_category_id(
            db,
            update_data.get("category_id"),
            update_data.get("category"),
        )
    update_data.pop("category", None)

    ingredients = update_data.pop("ingredients", None)

    for field, value in update_data.items():
        setattr(service, field, value)

    if ingredients is not None:
        # Clear existing ingredients
        db.query(ServiceProduct).filter(ServiceProduct.service_id == service.id).delete()
        # Add new ingredients
        for ing in ingredients:
            sp = ServiceProduct(
                service_id=service.id,
                product_id=ing["product_id"],
                amount_used=ing["amount_used"]
            )
            db.add(sp)

    db.commit()
    db.refresh(service)
    
    # Re-fetch with joined relations
    service = (
        db.query(Service)
        .options(joinedload(Service.category_rel), joinedload(Service.service_products).joinedload(ServiceProduct.product))
        .filter(Service.id == service.id)
        .first()
    )
    return _serialize_service(service)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    del current_user

    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")

    try:
        db.delete(service)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="لا يمكن حذف الخدمة لارتباطها ببيانات تشغيلية أو مالية",
        ) from None

    return None



