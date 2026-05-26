from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
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

router = APIRouter(prefix="/products", tags=["Products Inventory"])


def _get_estimated_gram_cost(product: Product) -> Decimal:
    weight = Decimal(str(product.weight or 0))
    cost_price = Decimal(str(product.cost_price or 0))

    if weight > 0:
        return cost_price / weight
    if (product.unit or "g").lower() == "g":
        return cost_price
    return Decimal("0")


@router.get("", response_model=list[ProductRead])
def list_products(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    return db.query(Product).order_by(Product.id.desc()).offset(offset).limit(limit).all()


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
    product = Product(**payload.model_dump())
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

    for field, value in payload.model_dump().items():
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

    add_stock(
        db,
        product=product,
        amount=payload.amount,
        note=payload.note,
        created_by_user_id=current_user.id,
    )

    if payload.create_expense:
        if payload.purchase_price is not None:
            total_cost = Decimal(str(payload.purchase_price))
        else:
            total_cost = Decimal(str(payload.amount)) * _get_estimated_gram_cost(product)
        expense_note = payload.note or f"توريد مخزون للمنتج {product.name}"
        if payload.invoice_image_url:
            expense_note = f"{expense_note}\nمرفق: {payload.invoice_image_url}"
        db.add(
            Expense(
                amount=float(total_cost),
                category="مشتريات مخزون",
                description=expense_note,
                recipient_name=product.name,
            )
        )

    db.commit()
    db.refresh(product)
    return product


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
