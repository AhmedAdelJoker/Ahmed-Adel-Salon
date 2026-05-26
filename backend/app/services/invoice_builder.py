from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.employee import Employee
from app.models.inventory_log import InventoryLog
from app.models.invoice_item import InvoiceItem
from app.models.product import Product
from app.models.service import Service
from app.models.offer import Offer, OfferService


def build_service_invoice_item(
    db: Session,
    *,
    service_id: int,
    quantity: int = 1,
    employee_id: int | None = None,
):
    service = db.query(Service).options(joinedload(Service.service_products)).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail=f"Service not found: {service_id}")

    qty = int(quantity or 1)
    if qty < 1:
        raise HTTPException(status_code=400, detail="Service quantity must be at least 1")

    unit_price = Decimal(str(service.price or 0))
    line_total = unit_price * qty
    commission_amount = Decimal("0.00")

    if employee_id is not None:
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail=f"Employee not found: {employee_id}")

        rate = Decimal(str(employee.commission_rate or 0)) / Decimal("100")
        commission_amount = (line_total * rate).quantize(Decimal("0.01"))

    item = InvoiceItem(
        item_type="service",
        service_id=service.id,
        employee_id=employee_id,
        service_name=service.name,
        quantity=qty,
        unit_price=unit_price,
        total_price=line_total,
        commission_amount=commission_amount,
    )

    product_actions = []
    if service.service_products:
        for sp in service.service_products:
            prod = db.query(Product).filter(Product.id == sp.product_id).first()
            if prod:
                total_consume = Decimal(str(sp.amount_used)) * qty
                product_actions.append((prod, total_consume))

    return item, line_total, product_actions


def build_product_invoice_item(
    db: Session,
    *,
    product_id: int,
    quantity: int = 1,
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product not found: {product_id}")
    if not product.is_active:
        raise HTTPException(status_code=400, detail=f"المنتج {product.name} غير نشط")

    qty = Decimal(str(int(quantity or 1)))
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Product quantity must be at least 1")

    unit_price = Decimal(str(product.sell_price or 0))
    if unit_price <= 0:
        raise HTTPException(status_code=400, detail=f"المنتج {product.name} لا يملك سعر بيع صالح")

    current_qty = Decimal(str(product.quantity or 0))
    if current_qty < qty:
        raise HTTPException(status_code=400, detail=f"الكمية غير كافية من المنتج {product.name}")

    item = InvoiceItem(
        item_type="product",
        product_id=product.id,
        service_name=product.name,
        quantity=int(qty),
        unit_price=unit_price,
        total_price=unit_price * qty,
        commission_amount=Decimal("0.00"),
    )
    return item, unit_price * qty, (product, qty)


def build_offer_invoice_items(
    db: Session,
    *,
    offer_id: int,
    quantity: int = 1,
    employee_id: int | None = None,
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail=f"Offer not found: {offer_id}")
    if not offer.is_active:
        raise HTTPException(status_code=400, detail=f"العرض {offer.name} غير نشط")

    offer_svcs = db.query(OfferService).filter(OfferService.offer_id == offer_id).all()
    if not offer_svcs:
        raise HTTPException(status_code=400, detail="العرض لا يحتوي على خدمات")

    qty = int(quantity or 1)
    offer_price = Decimal(str(offer.offer_price or 0)) * qty
    original_total = Decimal(str(offer.original_price or 0))
    
    # If original_price is missing or 0, calculate it from services
    if original_total <= 0:
        for os in offer_svcs:
            svc = db.query(Service).filter(Service.id == os.service_id).first()
            if svc:
                original_total += Decimal(str(svc.price or 0)) * os.quantity

    items = []
    total_distributed = Decimal("0.00")
    
    employee = None
    if employee_id is not None:
        employee = db.query(Employee).filter(Employee.id == employee_id).first()

    for i, os in enumerate(offer_svcs):
        service = db.query(Service).filter(Service.id == os.service_id).first()
        if not service:
            continue
            
        svc_qty = os.quantity * qty
        svc_orig_price = Decimal(str(service.price or 0))
        
        # Calculate proportional price
        if original_total > 0:
            weight = (svc_orig_price * os.quantity) / original_total
            if i == len(offer_svcs) - 1:
                # Last item takes the remainder to avoid rounding issues
                svc_offer_total = offer_price - total_distributed
            else:
                svc_offer_total = (offer_price * weight).quantize(Decimal("0.01"))
                total_distributed += svc_offer_total
        else:
            svc_offer_total = (offer_price / len(offer_svcs)).quantize(Decimal("0.01"))
            total_distributed += svc_offer_total

        # Commission calculation based on the discounted offer price
        commission_amount = Decimal("0.00")
        if employee:
            rate = Decimal(str(employee.commission_rate or 10)) / Decimal("100")
            commission_amount = (svc_offer_total * rate).quantize(Decimal("0.01"))

        items.append(InvoiceItem(
            item_type="service",
            service_id=service.id,
            employee_id=employee_id,
            service_name=f"{service.name} ({offer.name})",
            quantity=svc_qty,
            unit_price=(svc_offer_total / svc_qty).quantize(Decimal("0.01")) if svc_qty > 0 else 0,
            total_price=svc_offer_total,
            commission_amount=commission_amount,
        ))

    return items, offer_price


def apply_product_inventory_deductions(
    db: Session,
    *,
    product_actions: list[tuple[Product, Decimal]],
    created_by_user_id: int | None,
    note: str,
):
    for product, qty in product_actions:
        current_qty = Decimal(str(product.quantity or 0))
        if current_qty < qty:
            raise HTTPException(status_code=400, detail=f"الكمية غير كافية من المنتج {product.name}")

        product.quantity = current_qty - qty
        db.add(product)
        db.add(
            InventoryLog(
                product_id=product.id,
                change_amount=-qty,
                type="sale_invoice",
                note=note,
                created_by_user_id=created_by_user_id,
            )
        )



