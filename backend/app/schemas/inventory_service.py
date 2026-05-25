from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.inventory_log import InventoryLog


def add_stock(
    db: Session,
    *,
    product: Product,
    amount: Decimal,
    note: str | None,
    created_by_user_id: int | None,
):
    product.quantity = Decimal(str(product.quantity or 0)) + Decimal(str(amount))

    log = InventoryLog(
        product_id=product.id,
        change_amount=Decimal(str(amount)),
        type="add",
        note=note,
        created_by_user_id=created_by_user_id,
    )
    db.add(log)
    db.add(product)
    return product


def remove_stock(
    db: Session,
    *,
    product: Product,
    amount: Decimal,
    note: str | None,
    created_by_user_id: int | None,
):
    current_qty = Decimal(str(product.quantity or 0))
    amount = Decimal(str(amount))

    if current_qty < amount:
        raise HTTPException(status_code=400, detail="الكمية غير كافية في المخزون")

    product.quantity = current_qty - amount

    log = InventoryLog(
        product_id=product.id,
        change_amount=-amount,
        type="remove",
        note=note,
        created_by_user_id=created_by_user_id,
    )
    db.add(log)
    db.add(product)
    return product


def adjust_stock(
    db: Session,
    *,
    product: Product,
    new_quantity: Decimal,
    note: str | None,
    created_by_user_id: int | None,
):
    current_qty = Decimal(str(product.quantity or 0))
    new_quantity = Decimal(str(new_quantity))
    delta = new_quantity - current_qty

    product.quantity = new_quantity

    log = InventoryLog(
        product_id=product.id,
        change_amount=delta,
        type="adjust",
        note=note,
        created_by_user_id=created_by_user_id,
    )
    db.add(log)
    db.add(product)
    return product
