from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.inventory_log import InventoryLog


def add_stock(db: Session, *, product: Product, amount: Decimal, note: str | None, created_by_user_id: int | None):
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


def remove_stock(db: Session, *, product: Product, amount: Decimal, note: str | None, created_by_user_id: int | None):
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


def adjust_stock(db: Session, *, product: Product, new_quantity: Decimal, note: str | None, created_by_user_id: int | None):
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


def deduct_stock_for_invoice(db: Session, invoice_id: int, created_by_user_id: int | None = None):
    """
    Deducts stock for an invoice. 
    Handles both direct product sales and service ingredients.
    """
    from app.models.invoice import Invoice
    from app.models.invoice_item import InvoiceItem
    from app.models.service import Service
    from app.models.service_product import ServiceProduct

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return

    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()

    for item in items:
        # 1. If it's a direct product sale
        if item.product_id:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                # Use weight as multiplier if it's a direct product sale, matching existing POS logic
                multiplier = Decimal(str(product.weight or 1))
                amount_to_deduct = multiplier * Decimal(str(item.quantity or 1))
                remove_stock(
                    db,
                    product=product,
                    amount=amount_to_deduct,
                    note=f"بيع مباشر - فاتورة {invoice.invoice_no}",
                    created_by_user_id=created_by_user_id
                )
        
        # 2. If it's a service, deduct its ingredients
        if item.service_id:
            service = db.query(Service).filter(Service.id == item.service_id).first()
            if service and service.ingredients:
                for ingredient in service.ingredients:
                    product = ingredient.product
                    if product:
                        amount_to_deduct = Decimal(str(ingredient.amount_used)) * Decimal(str(item.quantity or 1))
                        remove_stock(
                            db,
                            product=product,
                            amount=amount_to_deduct,
                            note=f"استخدام في خدمة '{service.name}' - فاتورة {invoice.invoice_no}",
                            created_by_user_id=created_by_user_id
                        )


def deduct_stock_for_session(db: Session, session_id: int, created_by_user_id: int | None = None):
    """
    Deducts stock for products used in a service session.
    """
    from app.models.service_session import ServiceSession
    from app.models.session_product import SessionProduct

    session = db.query(ServiceSession).filter(ServiceSession.id == session_id).first()
    if not session:
        return

    session_products = db.query(SessionProduct).filter(SessionProduct.session_id == session.id).all()

    for sp in session_products:
        product = sp.product
        if product:
            remove_stock(
                db,
                product=product,
                amount=Decimal(str(sp.quantity_used or 0)),
                note=f"استخدام في جلسة عمل رقم {session.id}",
                created_by_user_id=created_by_user_id
            )
