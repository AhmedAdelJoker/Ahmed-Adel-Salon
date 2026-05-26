from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner
from app.models.user import User
from app.models.product import Product
from app.models.inventory_log import InventoryLog
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.schemas.inventory import InventoryAdjustPayload, InventoryLogRead
from app.services.inventory_service import add_stock, remove_stock, adjust_stock

router = APIRouter(prefix="/products", tags=["Products Inventory"])


@router.get("")
def list_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
):
    query = db.query(Product)
    if q:
        search = f"%{q}%"
        query = query.filter(Product.name.ilike(search))
    
    total = query.count()
    items = query.order_by(Product.id.desc()).offset(skip).limit(limit).all()
    
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }


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


from app.models.expense import Expense
from app.models.pos_shift import PosShift

@router.post("/{product_id}/add-stock", response_model=ProductRead)
def add_product_stock(
    product_id: int,
    payload: InventoryAdjustPayload,
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
        price = payload.purchase_price or product.cost_price or 0
        total_amount = payload.amount * price
        if total_amount > 0:
            shift = db.query(PosShift).filter(
                PosShift.cashier_user_id == current_user.id,
                PosShift.status == "open"
            ).order_by(PosShift.opened_at.desc()).first()

            expense = Expense(
                title=f"شراء منتج: {product.name}",
                description=f"توريد كمية {payload.amount} {product.unit}. {payload.note or ''}",
                amount=total_amount,
                category="مشتريات",
                payment_method="cash",
                expense_date=datetime.now(),
                status="recorded",
                invoice_image_url=payload.invoice_image_url,
                created_by_user_id=current_user.id,
                shift_id=shift.id if shift else None
            )
            db.add(expense)

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


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    db.delete(product)
    db.commit()
    return None



