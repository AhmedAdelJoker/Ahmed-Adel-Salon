from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner
from app.models.expense import Expense
from app.models.user import User
from app.models.product import Product
from app.models.inventory_log import InventoryLog
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.schemas.inventory import InventoryAddStockPayload, InventoryAdjustPayload, InventoryLogRead
from app.services.inventory_service import add_stock, remove_stock, adjust_stock
from app.utils.media import process_image_content, get_upload_path

router = APIRouter(prefix="/products", tags=["Products Inventory"])


def _get_estimated_gram_cost(product: Product) -> Decimal:
    weight = Decimal(str(product.weight or 0))
    cost_price = Decimal(str(product.cost_price or 0))

    if weight > 0:
        return cost_price / weight
    if (product.unit or "g").lower() == "g":
        return cost_price
    return Decimal("0")


from sqlalchemy import or_

@router.get("", response_model=list[ProductRead])
def list_products(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_archived: Optional[bool] = Query(None),
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(Product)
    
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                Product.name.ilike(search),
                Product.sku.ilike(search),
                Product.company_name.ilike(search)
            )
        )
    
    if category:
        query = query.filter(Product.category == category)
        
    if is_archived is not None:
        query = query.filter(Product.is_archived == is_archived)
        
    return query.order_by(Product.id.desc()).offset(offset).limit(limit).all()


@router.get("/logs/all", response_model=list[InventoryLogRead])
def list_all_inventory_logs(
    type: Optional[str] = Query(None), # add, remove, adjust
    product_id: Optional[int] = Query(None),
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(InventoryLog)
    
    if type:
        query = query.filter(InventoryLog.type == type)
    if product_id:
        query = query.filter(InventoryLog.product_id == product_id)
        
    return query.order_by(InventoryLog.id.desc()).limit(limit).all()


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    return product


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    # Create Product with 0 quantity
    product = Product(**payload.model_dump())
    product.quantity = 0
    db.add(product)
    db.commit()
    db.refresh(product)
    return product



@router.put("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    # Update fields except quantity (which is managed via logs)
    data = payload.model_dump()
    if "quantity" in data:
        del data["quantity"]

    for field, value in data.items():
        setattr(product, field, value)

    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/add-stock", response_model=ProductRead)
def add_product_stock(
    product_id: int,
    payload: InventoryAddStockPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    # If purchase price is provided and different from current cost_price, update it
    price_changed = False
    if payload.purchase_price is not None and Decimal(str(payload.purchase_price)) != Decimal(str(product.cost_price or 0)):
        product.cost_price = Decimal(str(payload.purchase_price))
        price_changed = True

    # Amount in packs is multiplied by weight to get total quantity in units (g/ml)
    # If weight is not set, we assume 1 unit = 1 pack (e.g. piece)
    multiplier = Decimal(str(product.weight or 1))
    total_units = Decimal(str(payload.amount)) * multiplier

    add_stock(
        db,
        product=product,
        amount=total_units,
        note=payload.note or f"توريد {payload.amount} عبوة",
        created_by_user_id=current_user.id,
    )
    
    # Auto-unarchive when adding stock
    product.is_archived = False

    if payload.create_expense:
        # Total cost is already provided or calculated based on new/existing cost_price
        total_cost = Decimal(str(payload.purchase_price or product.cost_price or 0)) * Decimal(str(payload.amount))
        
        expense_note = payload.note or f"توريد مخزون للمنتج {product.name} ({payload.amount} عبوة)"
        if price_changed:
            expense_note += f" - [تغير في سعر الشراء إلى {product.cost_price}]"
        
        if payload.invoice_image_url:
            expense_note = f"{expense_note}\nمرفق: {payload.invoice_image_url}"
        
        db.add(
            Expense(
                amount=float(total_cost),
                category="مشتريات مخزون",
                description=expense_note,
                recipient_name=product.company_name or product.name,
                created_by_user_id=current_user.id
            )
        )

    db.commit()
    db.refresh(product)
    
    # Return enriched response if price changed to notify frontend
    return product


@router.patch("/{product_id}/update-prices")
def update_product_prices(
    product_id: int,
    sell_price: Optional[Decimal] = Query(None),
    cost_price: Optional[Decimal] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    
    if sell_price is not None:
        product.sell_price = sell_price
    if cost_price is not None:
        product.cost_price = cost_price
        
    db.commit()
    return {"status": "success", "sell_price": product.sell_price, "cost_price": product.cost_price}


@router.post("/{product_id}/remove-stock", response_model=ProductRead)
def remove_product_stock(
    product_id: int,
    payload: InventoryAdjustPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    remove_stock(
        db,
        product=product,
        amount=payload.amount,
        note=payload.note,
        created_by_user_id=current_user.id,
    )
    
    # Auto-archive if quantity hits zero
    if product.quantity <= 0:
        product.is_archived = True

    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/toggle-archive", response_model=ProductRead)
def toggle_product_archive(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    product.is_archived = not product.is_archived
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/adjust-stock", response_model=ProductRead)
def adjust_product_stock(
    product_id: int,
    payload: InventoryAdjustPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    adjust_stock(
        db,
        product=product,
        new_quantity=payload.amount,
        note=payload.note,
        created_by_user_id=current_user.id,
    )

    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}/logs", response_model=list[InventoryLogRead])
def get_product_logs(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    return (
        db.query(InventoryLog)
        .filter(InventoryLog.product_id == product_id)
        .order_by(InventoryLog.id.desc())
        .all()
    )


@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Upload a product image and return the URL."""
    content = await file.read()
    upload_dir = get_upload_path("products")
    filename = process_image_content(content, file.filename, upload_dir)
    return {"url": f"/uploads/products/{filename}"}


@router.patch("/{product_id}/update-image", response_model=ProductRead)
def update_product_image(
    product_id: int,
    image_url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Update product image URL. Owner only."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    product.image_url = image_url
    db.commit()
    db.refresh(product)
    return product
