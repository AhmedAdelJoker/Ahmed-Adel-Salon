from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_any_staff
from app.db.session import get_db
from app.models.offer import Offer
from app.models.offer_service import OfferService
from app.models.offer_product import OfferProduct
from app.models.service import Service
from app.models.product import Product
from app.models.user import User
from app.schemas.offer import OfferCreate, OfferRead, OfferServiceRead, OfferProductRead, OfferUpdate

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from app.utils.media import process_image_content, get_upload_path
from app.core.upload_security import validate_image

router = APIRouter(prefix="/offers", tags=["Offers"])


@router.post("/upload-image")
async def upload_offer_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_any_staff),
):
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image(file, max_size=5 * 1024 * 1024)
    upload_dir = get_upload_path("offers")
    filename = process_image_content(content, file.filename, upload_dir)
    return {"url": f"/uploads/offers/{filename}"}


def _serialize_offer(row: Offer) -> OfferRead:
    return OfferRead(
        id=row.id,
        name=row.name,
        name_ar=row.name_ar,
        name_en=row.name_en,
        description=row.description,
        description_ar=row.description_ar,
        description_en=row.description_en,
        image_url=row.image_url,
        original_price=row.original_price,
        offer_price=row.offer_price,
        discount_percentage=row.discount_percentage,
        start_date=row.start_date,
        end_date=row.end_date,
        is_public=row.is_public,
        is_active=row.is_active,
        created_at=row.created_at,
        services=[
            OfferServiceRead(
                id=item.service.id,
                name=item.service.name,
                price=item.service.price,
            )
            for item in (row.offer_services or [])
            if item.service
        ],
        offer_products=[
            OfferProductRead(
                id=item.id,
                product_id=item.product.id,
                quantity=item.quantity,
                product_name=item.product.name,
                product_price=item.product.sell_price,
            )
            for item in (row.offer_products or [])
            if item.product
        ],
    )


def _sync_offer_services(db: Session, offer: Offer, service_ids: list[int]) -> None:
    db.query(OfferService).filter(OfferService.offer_id == offer.id).delete()

    rows: list[OfferService] = []
    for service_id in service_ids or []:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail=f"الخدمة {service_id} غير موجودة")
        rows.append(OfferService(offer_id=offer.id, service_id=service_id))

    if rows:
        db.add_all(rows)


def _sync_offer_products(db: Session, offer: Offer, products_data: list[dict]) -> None:
    db.query(OfferProduct).filter(OfferProduct.offer_id == offer.id).delete()

    rows: list[OfferProduct] = []
    for p_data in products_data or []:
        product_id = p_data.get("product_id")
        quantity = p_data.get("quantity", 1)
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"المنتج {product_id} غير موجود")
        rows.append(OfferProduct(offer_id=offer.id, product_id=product_id, quantity=quantity))

    if rows:
        db.add_all(rows)


def _prepare_offer_prices(db: Session, payload: OfferCreate | OfferUpdate) -> tuple:
    original_price = payload.original_price
    
    # Professional Touch: Auto-calculate original price if not provided
    if original_price is None or original_price == 0:
        calc_price = 0
        # Sum services
        if payload.service_ids:
            services = db.query(Service).filter(Service.id.in_(payload.service_ids)).all()
            calc_price += sum(s.price for s in services)
        # Sum products
        if payload.products:
            for p_data in payload.products:
                product = db.query(Product).filter(Product.id == p_data.get("product_id")).first()
                if product:
                    calc_price += product.sell_price * p_data.get("quantity", 1)
        original_price = calc_price

    discount_percentage = payload.discount_percentage

    if discount_percentage is None and original_price and payload.offer_price:
        try:
            discount_percentage = ((original_price - payload.offer_price) / original_price) * 100
        except Exception:
            discount_percentage = None

    return original_price, discount_percentage


@router.get("", response_model=list[OfferRead])
def list_offers(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    query = db.query(Offer).order_by(Offer.id.desc())
    response.headers["X-Total-Count"] = str(query.count())
    rows = (
        query
        .options(
            joinedload(Offer.offer_services).joinedload(OfferService.service),
            joinedload(Offer.offer_products).joinedload(OfferProduct.product)
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_serialize_offer(row) for row in rows]


@router.get("/active", response_model=list[OfferRead])
def list_active_offers(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    today = date.today()
    query = (
        db.query(Offer)
        .filter(Offer.is_active == True)
        .filter((Offer.start_date.is_(None)) | (Offer.start_date <= today))
        .filter((Offer.end_date.is_(None)) | (Offer.end_date >= today))
        .order_by(Offer.id.desc())
    )
    response.headers["X-Total-Count"] = str(query.count())
    rows = (
        query
        .options(
            joinedload(Offer.offer_services).joinedload(OfferService.service),
            joinedload(Offer.offer_products).joinedload(OfferProduct.product)
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_serialize_offer(row) for row in rows]


@router.get("/{offer_id}", response_model=OfferRead)
def get_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    offer = (
        db.query(Offer)
        .options(
            joinedload(Offer.offer_services).joinedload(OfferService.service),
            joinedload(Offer.offer_products).joinedload(OfferProduct.product)
        )
        .filter(Offer.id == offer_id)
        .first()
    )
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")
    return _serialize_offer(offer)


@router.post("", response_model=OfferRead, status_code=status.HTTP_201_CREATED)
def create_offer(
    payload: OfferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    original_price, discount_percentage = _prepare_offer_prices(db, payload)
    offer = Offer(
        name=payload.name,
        name_ar=payload.name_ar,
        name_en=payload.name_en,
        description=payload.description or payload.description_ar,
        description_ar=payload.description_ar,
        description_en=payload.description_en,
        image_url=payload.image_url,
        original_price=original_price,
        offer_price=payload.offer_price,
        discount_percentage=discount_percentage,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_public=payload.is_public,
        is_active=payload.is_active,
    )
    db.add(offer)
    db.flush()
    _sync_offer_services(db, offer, payload.service_ids)
    _sync_offer_products(db, offer, payload.products)
    db.commit()
    db.refresh(offer)
    offer = (
        db.query(Offer)
        .options(
            joinedload(Offer.offer_services).joinedload(OfferService.service),
            joinedload(Offer.offer_products).joinedload(OfferProduct.product)
        )
        .filter(Offer.id == offer.id)
        .first()
    )
    return _serialize_offer(offer)


@router.put("/{offer_id}", response_model=OfferRead)
def update_offer(
    offer_id: int,
    payload: OfferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")

    original_price, discount_percentage = _prepare_offer_prices(db, payload)
    offer.name = payload.name
    offer.name_ar = payload.name_ar
    offer.name_en = payload.name_en
    offer.description = payload.description or payload.description_ar
    offer.description_ar = payload.description_ar
    offer.description_en = payload.description_en
    offer.image_url = payload.image_url
    offer.original_price = original_price
    offer.offer_price = payload.offer_price
    offer.discount_percentage = discount_percentage
    offer.start_date = payload.start_date
    offer.end_date = payload.end_date
    offer.is_public = payload.is_public
    offer.is_active = payload.is_active
    
    _sync_offer_services(db, offer, payload.service_ids)
    _sync_offer_products(db, offer, payload.products)

    db.add(offer)
    db.commit()
    db.refresh(offer)
    offer = (
        db.query(Offer)
        .options(
            joinedload(Offer.offer_services).joinedload(OfferService.service),
            joinedload(Offer.offer_products).joinedload(OfferProduct.product)
        )
        .filter(Offer.id == offer.id)
        .first()
    )
    return _serialize_offer(offer)


@router.patch("/{offer_id}/toggle-active", response_model=OfferRead)
def toggle_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")
    offer.is_active = not bool(offer.is_active)
    db.add(offer)
    db.commit()
    db.refresh(offer)
    offer = (
        db.query(Offer)
        .options(
            joinedload(Offer.offer_services).joinedload(OfferService.service),
            joinedload(Offer.offer_products).joinedload(OfferProduct.product)
        )
        .filter(Offer.id == offer.id)
        .first()
    )
    return _serialize_offer(offer)


@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="العرض غير موجود")
    db.delete(offer)
    db.commit()
    return None
