"""Stock deduction must be idempotent.

The bug these guard against
--------------------------
Stock was deducted from three independent code paths — creating a service
session, completing that session, and issuing the invoice — with nothing
recording which document had already been applied. One sale could therefore
decrement the same product two or three times, and `inventory_logs` looked
individually plausible, so the corruption was invisible after the fact.

What is asserted here is not "the function is called once" but "the quantity is
correct no matter how many times the caller runs", because a retry after a
timeout, a double-clicked button and two racing workers are all the same problem
from the database's point of view.
"""

from decimal import Decimal

import pytest

from app.db.session import SessionLocal
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.product import Product
from app.models.service import Service
from app.models.service_product import ServiceProduct
from app.models.inventory_log import InventoryLog
from app.models.session_product import SessionProduct
from app.models.service_session import ServiceSession
from app.services.inventory_service import (
    deduct_stock_for_invoice,
    deduct_stock_for_session,
    remove_stock,
)


def _customer(db) -> Customer:
    """conftest truncates every table between tests, so the seeded walk-in
    customer does not exist. These cases are about stock, not about the customer
    record, so they create the minimum the foreign keys require."""
    customer = Customer(first_name="عميل", last_name="اختبار", phone="01000000001")
    db.add(customer)
    db.flush()
    return customer


def _employee(db) -> Employee:
    employee = Employee(full_name="حلاق اختبار", phone_primary="01000000002")
    db.add(employee)
    db.flush()
    return employee


def _product(db, *, name: str, quantity: str, weight: str = "1") -> Product:
    product = Product(name=name, quantity=Decimal(quantity), weight=Decimal(weight))
    db.add(product)
    db.flush()
    return product


def _invoice_with_product(db, product: Product, *, invoice_no: str, quantity: int) -> Invoice:
    invoice = Invoice(
        invoice_no=invoice_no,
        customer_id=_customer(db).customer_id,
        subtotal_amount=Decimal("100.00"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("100.00"),
    )
    db.add(invoice)
    db.flush()
    db.add(
        InvoiceItem(
            invoice_id=invoice.id,
            product_id=product.id,
            # `service_name` is NOT NULL and `quantity` is an Integer, both
            # pre-existing schema decisions. A product line therefore carries a
            # name in the service column and a whole-unit count. Worth revisiting
            # — weight-priced goods cannot be sold in fractions on a line — but
            # changing it belongs in its own migration, not in a security fix.
            service_name=product.name,
            quantity=quantity,
            unit_price=Decimal("50.00"),
        )
    )
    db.flush()
    return invoice


# --------------------------------------------------------------------------- #
# Invoice deduction
# --------------------------------------------------------------------------- #


def test_invoice_deducts_direct_product_sale_once():
    db = SessionLocal()
    try:
        product = _product(db, name="شامبو", quantity="10")
        invoice = _invoice_with_product(db, product, invoice_no="INV-T-0001", quantity=2)

        deduct_stock_for_invoice(db, invoice_id=invoice.id)
        db.commit()

        assert Decimal(str(product.quantity)) == Decimal("8")
    finally:
        db.close()


def test_calling_deduct_twice_deducts_only_once():
    """The regression this file exists for."""
    db = SessionLocal()
    try:
        product = _product(db, name="شامبو", quantity="10")
        invoice = _invoice_with_product(db, product, invoice_no="INV-T-0002", quantity=2)

        deduct_stock_for_invoice(db, invoice_id=invoice.id)
        first = Decimal(str(product.quantity))
        assert first == Decimal("8"), "the first deduction should consume 2 units"

        deduct_stock_for_invoice(db, invoice_id=invoice.id)
        db.commit()

        assert Decimal(str(product.quantity)) == first, (
            "a repeat deduction changed the quantity again"
        )

        moves = (
            db.query(InventoryLog)
            .filter(InventoryLog.source_type == "invoice", InventoryLog.source_id == invoice.id)
            .count()
        )
        assert moves == 1, f"expected exactly one movement row, found {moves}"
    finally:
        db.close()


def test_repeat_deduction_across_a_commit_boundary_is_still_a_no_op():
    """A client retry after a timeout lands in a brand new session.

    This is the realistic failure mode: the first request committed but the
    response never arrived, so the client re-sends. The in-session pre-check
    would not help across a commit, so only the persisted source reference can.
    """
    db = SessionLocal()
    try:
        product = _product(db, name="شامبو", quantity="10")
        invoice = _invoice_with_product(db, product, invoice_no="INV-T-0003", quantity=3)
        # Capture the identifiers while the session is still open. Closing it
        # detaches the instances, and a detached `invoice.id` raises on access.
        invoice_id = invoice.id
        product_id = product.id
        db.commit()
    finally:
        db.close()

    for _ in range(2):
        db = SessionLocal()
        try:
            deduct_stock_for_invoice(db, invoice_id=invoice_id)
            db.commit()
        finally:
            db.close()

    db = SessionLocal()
    try:
        reloaded = db.query(Product).filter(Product.id == product_id).one()
        assert Decimal(str(reloaded.quantity)) == Decimal("7"), (
            "three units should have been consumed once, not twice"
        )
    finally:
        db.close()


def test_weight_multiplies_the_deducted_amount():
    """A direct sale consumes whole packs, so `weight` scales the deduction."""
    db = SessionLocal()
    try:
        product = _product(db, name="عبوة", quantity="100", weight="5")
        invoice = _invoice_with_product(db, product, invoice_no="INV-T-0004", quantity=2)

        deduct_stock_for_invoice(db, invoice_id=invoice.id)
        db.commit()

        assert Decimal(str(product.quantity)) == Decimal("90")
    finally:
        db.close()


def test_service_ingredients_are_deducted_once_per_invoice():
    db = SessionLocal()
    try:
        ingredient = _product(db, name="صبغة", quantity="50")
        service = Service(name="صبغة شعر", price=Decimal("200.00"), duration_minutes=60)
        db.add(service)
        db.flush()
        db.add(
            ServiceProduct(
                service_id=service.id,
                product_id=ingredient.id,
                amount_used=Decimal("4"),
            )
        )
        db.flush()

        invoice = Invoice(
            invoice_no="INV-T-0005",
            customer_id=_customer(db).customer_id,
            subtotal_amount=Decimal("200.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("200.00"),
        )
        db.add(invoice)
        db.flush()
        db.add(
            InvoiceItem(
                invoice_id=invoice.id,
                service_id=service.id,
                service_name=service.name,
                quantity=1,
                unit_price=Decimal("200.00"),
            )
        )
        db.flush()

        deduct_stock_for_invoice(db, invoice_id=invoice.id)
        after_first = Decimal(str(ingredient.quantity))
        assert after_first == Decimal("46"), "one service should consume 4 units"

        deduct_stock_for_invoice(db, invoice_id=invoice.id)
        db.commit()

        assert Decimal(str(ingredient.quantity)) == after_first
    finally:
        db.close()


def test_two_invoices_deduct_independently():
    """Idempotency is per source, not global: a second sale still deducts."""
    db = SessionLocal()
    try:
        product = _product(db, name="شامبو", quantity="20")
        first = _invoice_with_product(db, product, invoice_no="INV-T-0006", quantity=2)
        second = _invoice_with_product(db, product, invoice_no="INV-T-0007", quantity=5)

        deduct_stock_for_invoice(db, invoice_id=first.id)
        deduct_stock_for_invoice(db, invoice_id=second.id)
        db.commit()

        assert Decimal(str(product.quantity)) == Decimal("13")
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# Session deduction
# --------------------------------------------------------------------------- #


def test_session_deduction_is_idempotent():
    db = SessionLocal()
    try:
        product = _product(db, name="قفازات", quantity="40")
        session = ServiceSession(
            customer_id=_customer(db).customer_id,
            barber_id=_employee(db).id,
            status="active",
        )
        db.add(session)
        db.flush()
        db.add(
            SessionProduct(
                session_id=session.id,
                product_id=product.id,
                quantity_used=Decimal("2"),
            )
        )
        db.flush()

        deduct_stock_for_session(db, session_id=session.id)
        assert Decimal(str(product.quantity)) == Decimal("38")

        deduct_stock_for_session(db, session_id=session.id)
        db.commit()

        assert Decimal(str(product.quantity)) == Decimal("38")
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# Manual adjustments stay unconstrained
# --------------------------------------------------------------------------- #


def test_manual_removals_are_never_treated_as_duplicates():
    """A stock correction has no source document, so repeats must still apply.

    Skipping these would silently make the inventory screen lie: an operator
    writing off three damaged units would have only the first recorded.
    """
    db = SessionLocal()
    try:
        product = _product(db, name="مناديل", quantity="30")

        remove_stock(
            db,
            product=product,
            amount=Decimal("1"),
            note="تالف 1",
            created_by_user_id=None,
        )
        remove_stock(
            db,
            product=product,
            amount=Decimal("1"),
            note="تالف 2",
            created_by_user_id=None,
        )
        db.commit()

        assert Decimal(str(product.quantity)) == Decimal("28")

        manual = db.query(InventoryLog).filter(InventoryLog.source_type.is_(None)).count()
        assert manual == 2, "each manual correction must be recorded"
    finally:
        db.close()


def test_insufficient_stock_still_raises():
    """Idempotency must not mask a genuine shortage."""
    db = SessionLocal()
    try:
        product = _product(db, name="شامبو", quantity="1")
        invoice = _invoice_with_product(db, product, invoice_no="INV-T-0008", quantity=5)

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as excinfo:
            deduct_stock_for_invoice(db, invoice_id=invoice.id)
        assert excinfo.value.status_code == 400
    finally:
        db.close()
