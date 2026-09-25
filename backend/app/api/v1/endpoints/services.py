from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile, Response
from sqlalchemy.orm import Session, joinedload
import os
import uuid
from pathlib import Path

from app.db.session import get_db
from app.api.deps import require_any_staff, require_manage_catalog
from app.models.user import User
from app.models.product import Product
from app.models.service import Service
from app.models.service_category import ServiceCategory
from app.models.service_product import ServiceProduct
from app.schemas.inventory import ServiceProductRead
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate
from app.utils.media import process_image_content, get_upload_path
from app.core.upload_security import validate_image

router = APIRouter(prefix="/services", tags=["Services"])


@router.post("/upload-image")
async def upload_service_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_manage_catalog),
):
    """
    Uploads a service image and returns the URL.
    """
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image(file, max_size=5 * 1024 * 1024)
    upload_dir = get_upload_path("business")
    filename = process_image_content(content, file.filename, upload_dir)
    return {"url": f"/uploads/business/{filename}"}


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
    response: Response = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    # Phase 2: modern pagination params + sort
    skip: int = Query(0, ge=0, description="Records to skip (alias for offset)"),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=1000),
    sort: Optional[str] = Query(None, description="Sort field. '-' prefix for DESC"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    query = db.query(Service).options(
        joinedload(Service.category_rel),
        joinedload(Service.ingredients).joinedload(ServiceProduct.product),
    )

    # Phase 2: explicit sort
    if sort:
        sort_field = sort.lstrip("-")
        desc = sort.startswith("-")
        column = getattr(Service, sort_field, None)
        if column is not None:
            query = query.order_by(column.desc() if desc else column.asc())
    else:
        query = query.order_by(Service.id.desc())

    # Phase 2: normalize page/page_size → skip/offset, fallback to legacy offset
    eff_offset = offset
    eff_limit = limit
    if page is not None and page_size is not None:
        eff_offset = (page - 1) * page_size
        eff_limit = page_size
    elif skip > 0:
        eff_offset = skip

    # Phase 2: count + headers
    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)
    rows = query.offset(eff_offset).limit(eff_limit).all()
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
    current_user: User = Depends(require_manage_catalog),
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
    current_user: User = Depends(require_manage_catalog),
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
    current_user: User = Depends(require_manage_catalog),
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")

    db.delete(service)
    db.commit()
    return None
