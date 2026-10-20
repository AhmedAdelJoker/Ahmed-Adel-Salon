"""Stock movements.

Every deduction that originates from a document (an invoice, a session) carries
a *source reference*, and the schema enforces that a given product is deducted at
most once per source. That is what makes the operation idempotent: re-running a
finalisation, retrying a failed request, or two workers racing on the same
invoice all converge on "deducted exactly once" instead of silently corrupting
the quantity.

`remove_stock` therefore has two callers' worth of behaviour: manual adjustments
(no source, always applied) and document deductions (source present, applied
once and only once).
"""

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.inventory_log import InventoryLog

# Source kinds recorded on InventoryLog.source_type.
SOURCE_INVOICE = "invoice"
SOURCE_SESSION = "session"


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


def _already_deducted(
    db: Session, *, source_type: str, source_id: int, product_id: int
) -> bool:
    """True when this product has already been deducted for this source."""
    existing = (
        db.query(InventoryLog.id)
        .filter(
            InventoryLog.source_type == source_type,
            InventoryLog.source_id == source_id,
            InventoryLog.product_id == product_id,
        )
        .first()
    )
    return existing is not None


def remove_stock(
    db: Session,
    *,
    product: Product,
    amount: Decimal,
    note: str | None,
    created_by_user_id: int | None,
    source_type: str | None = None,
    source_id: int | None = None,
):
    """Decreases stock and records the movement.

    When `source_type` and `source_id` are supplied the call is idempotent per
    (source, product): a repeat is a no-op rather than a second decrement. This
    is the guard that stops a single sale from depleting stock three times
    because three different code paths each thought they owned the deduction.

    Returns the product, or None when the movement was skipped as a duplicate.
    """
    amount = Decimal(str(amount))

    if amount <= 0:
        raise HTTPException(status_code=400, detail="كمية خصم المخزون يجب أن تكون أكبر من صفر")

    if source_type is not None and source_id is not None:
        if _already_deducted(
            db, source_type=source_type, source_id=source_id, product_id=product.id
        ):
            return None

    current_qty = Decimal(str(product.quantity or 0))
    if current_qty < amount:
        raise HTTPException(status_code=400, detail="الكمية غير كافية في المخزون")

    product.quantity = current_qty - amount
    log = InventoryLog(
        product_id=product.id,
        change_amount=-amount,
        type="remove",
        note=note,
        created_by_user_id=created_by_user_id,
        source_type=source_type,
        source_id=source_id,
    )
    db.add(log)
    db.add(product)

    # The pre-check above closes the common case, but it is a read followed by a
    # write and therefore racy: two concurrent finalisations of the same invoice
    # can both see "not yet deducted" before either flushes. The unique
    # constraint is the real guard, so surface it as a skip rather than a 500.
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return None

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
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="لا يمكن أن يكون رصيد المخزون سالبًا")
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


def _deduct(
    db: Session,
    *,
    product: Product | None,
    amount: Decimal,
    note: str,
    created_by_user_id: int | None,
    source_type: str,
    source_id: int,
):
    """Applies one deduction, tolerating a duplicate source."""
    if not product or amount <= 0:
        return
    remove_stock(
        db,
        product=product,
        amount=amount,
        note=note,
        created_by_user_id=created_by_user_id,
        source_type=source_type,
        source_id=source_id,
    )


def deduct_stock_for_invoice(
    db: Session, invoice_id: int, created_by_user_id: int | None = None
):
    """Deducts stock for an invoice.

    Covers direct product sales, service ingredients, and everything bundled
    inside an offer. Safe to call more than once for the same invoice: the
    per-product source reference makes the second call a no-op.
    """
    from app.models.invoice import Invoice
    from app.models.invoice_item import InvoiceItem
    from app.models.offer import Offer
    from app.models.service import Service
    from app.models.service_product import ServiceProduct  # noqa: F401  (relationship import)

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return

    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
    source = (SOURCE_INVOICE, invoice.id)

    for item in items:
        if item.offer_id:
            offer = db.query(Offer).filter(Offer.id == item.offer_id).first()
            if offer:
                for offer_product in offer.offer_products:
                    _deduct(
                        db,
                        product=offer_product.product,
                        amount=Decimal(str(offer_product.quantity or 0))
                        * Decimal(str(item.quantity or 1)),
                        note=f"عرض {offer.name} - فاتورة {invoice.invoice_no}",
                        created_by_user_id=created_by_user_id,
                        source_type=source[0],
                        source_id=source[1],
                    )
                for offer_service in offer.offer_services:
                    service = offer_service.service
                    if service and service.ingredients:
                        for ingredient in service.ingredients:
                            _deduct(
                                db,
                                product=ingredient.product,
                                amount=Decimal(str(ingredient.amount_used))
                                * Decimal(str(item.quantity or 1)),
                                note=(
                                    f"خدمة داخل العرض {offer.name} - "
                                    f"فاتورة {invoice.invoice_no}"
                                ),
                                created_by_user_id=created_by_user_id,
                                source_type=source[0],
                                source_id=source[1],
                            )

        # Direct product sale. `weight` is the pack size, so one unit of sale
        # consumes `weight` units of stock.
        if item.product_id:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                _deduct(
                    db,
                    product=product,
                    amount=Decimal(str(product.weight or 1))
                    * Decimal(str(item.quantity or 1)),
                    note=f"بيع مباشر - فاتورة {invoice.invoice_no}",
                    created_by_user_id=created_by_user_id,
                    source_type=source[0],
                    source_id=source[1],
                )

        # Service ingredients consumed by performing the service.
        if item.service_id:
            service = db.query(Service).filter(Service.id == item.service_id).first()
            if service and service.ingredients:
                for ingredient in service.ingredients:
                    _deduct(
                        db,
                        product=ingredient.product,
                        amount=Decimal(str(ingredient.amount_used))
                        * Decimal(str(item.quantity or 1)),
                        note=(
                            f"استخدام في خدمة '{service.name}' - "
                            f"فاتورة {invoice.invoice_no}"
                        ),
                        created_by_user_id=created_by_user_id,
                        source_type=source[0],
                        source_id=source[1],
                    )


def deduct_stock_for_session(
    db: Session, session_id: int, created_by_user_id: int | None = None
):
    """Deducts stock for products recorded against a service session.

    Currently unreferenced by any endpoint: the session flow is driven through
    the invoice, which deducts once with an invoice-scoped reference. It is kept
    because completing a session is the natural place to record "this barber
    used this much dye", and the idempotency guard means wiring it up later
    cannot double-deduct against an invoice that already covered the same work.
    """
    from app.models.service_session import ServiceSession
    from app.models.session_product import SessionProduct

    session = db.query(ServiceSession).filter(ServiceSession.id == session_id).first()
    if not session:
        return

    session_products = (
        db.query(SessionProduct).filter(SessionProduct.session_id == session.id).all()
    )
    if not session_products:
        return

    for sp in session_products:
        _deduct(
            db,
            product=sp.product,
            amount=Decimal(str(sp.quantity_used or 0)),
            note=f"استخدام في جلسة عمل رقم {session.id}",
            created_by_user_id=created_by_user_id,
            source_type=SOURCE_SESSION,
            source_id=session.id,
        )
