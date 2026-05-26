from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_any_staff
from app.models.user import User
from app.models.product import Product
from app.models.service import Service
from app.models.service_category import ServiceCategory
from app.models.service_product import ServiceProduct
from app.schemas.inventory import ServiceProductRead
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter(prefix="/services", tags=["Services"])


def _serialize_ingredient(row: ServiceProduct) -> ServiceProductRead:
    return ServiceProductRead(
        id=row.id,
        service_id=row.service_id,
        product_id=row.product_id,
        amount_used=row.amount_used,
        product_name=row.product.name if row.product else None,
        product_unit=row.product.unit if row.product else None,
        product_quantity=row.product.quantity if row.product else None,
        product_cost_price=row.product.cost_price if row.product else None,
        product_weight=row.product.weight if row.product else None,
    )


def _serialize_service(row: Service) -> ServiceRead:
    category_name = row.category
    if row.category_rel:
        category_name = row.category_rel.name_ar or row.category_rel.name

    return ServiceRead(
        id=row.id,
        name=row.name,
        name_ar=row.name_ar,
        name_en=row.name_en,
        description_ar=row.description_ar,
        description_en=row.description_en,
        image_url=row.image_url,
        category=category_name,
        category_id=row.category_id,
        price=row.price,
        duration_minutes=row.duration_minutes,
        is_active=row.is_active,
        created_at=row.created_at,
        ingredients=[_serialize_ingredient(item) for item in (row.ingredients or [])],
    )


def _sync_service_ingredients(db: Session, service: Service, ingredients: list) -> None:
    db.query(ServiceProduct).filter(ServiceProduct.service_id == service.id).delete()

    rows: list[ServiceProduct] = []
    for ingredient in ingredients or []:
        product = db.query(Product).filter(Product.id == ingredient.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"المنتج {ingredient.product_id} غير موجود",
            )
        rows.append(
            ServiceProduct(
                service_id=service.id,
                product_id=ingredient.product_id,
                amount_used=ingredient.amount_used,
            )
        )

    if rows:
        db.add_all(rows)


def _resolve_category(db: Session, payload: ServiceCreate | ServiceUpdate) -> tuple[int | None, str | None]:
    if payload.category_id is None:
        return None, payload.category

    category = db.query(ServiceCategory).filter(ServiceCategory.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="تصنيف الخدمة غير موجود")
    return category.id, category.name_ar or category.name


@router.get("", response_model=list[ServiceRead])
def list_services(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    rows = (
        db.query(Service)
        .options(
            joinedload(Service.category_rel),
            joinedload(Service.ingredients).joinedload(ServiceProduct.product),
        )
        .order_by(Service.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_serialize_service(row) for row in rows]


@router.get("/{service_id}", response_model=ServiceRead)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    service = (
        db.query(Service)
        .options(
            joinedload(Service.category_rel),
            joinedload(Service.ingredients).joinedload(ServiceProduct.product),
        )
        .filter(Service.id == service_id)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")
    return _serialize_service(service)


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    category_id, category_name = _resolve_category(db, payload)
    service = Service(
        name=payload.name,
        name_ar=payload.name_ar,
        name_en=payload.name_en,
        description_ar=payload.description_ar,
        description_en=payload.description_en,
        image_url=payload.image_url,
        category=category_name,
        category_id=category_id,
        price=payload.price,
        duration_minutes=payload.duration_minutes,
        is_active=payload.is_active,
    )
    db.add(service)
    db.flush()
    _sync_service_ingredients(db, service, payload.ingredients)
    db.commit()
    db.refresh(service)
    service = (
        db.query(Service)
        .options(
            joinedload(Service.category_rel),
            joinedload(Service.ingredients).joinedload(ServiceProduct.product),
        )
        .filter(Service.id == service.id)
        .first()
    )
    return _serialize_service(service)


@router.put("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")

    category_id, category_name = _resolve_category(db, payload)
    service.name = payload.name
    service.name_ar = payload.name_ar
    service.name_en = payload.name_en
    service.description_ar = payload.description_ar
    service.description_en = payload.description_en
    service.image_url = payload.image_url
    service.category = category_name
    service.category_id = category_id
    service.price = payload.price
    service.duration_minutes = payload.duration_minutes
    service.is_active = payload.is_active
    _sync_service_ingredients(db, service, payload.ingredients)

    db.add(service)
    db.commit()
    db.refresh(service)
    service = (
        db.query(Service)
        .options(
            joinedload(Service.category_rel),
            joinedload(Service.ingredients).joinedload(ServiceProduct.product),
        )
        .filter(Service.id == service.id)
        .first()
    )
    return _serialize_service(service)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")

    db.delete(service)
    db.commit()
    return None
