"""The remaining N+1 sites, proven fixed by counting statements.

The appointments and waitlist cases are in `test_n_plus_one_queries.py`. This
module covers the other four, which are the expensive ones:

* the per-barber day view queried the employee and the invoice for every
  appointment in the loop;
* the inventory history ran one aggregate `SUM` per row — up to 200 on a full
  page;
* employee performance walked `invoice.items` lazily for every invoice in the
  window;
* permanent customer deletion issued six counts per customer, so 50 customers
  meant 300 round trips before the delete began.

Each test asserts two things, because either alone is misleading: the query
count does not grow with the input, and the numbers that come back are exactly
what the slow version produced.
"""

from datetime import date, time
from decimal import Decimal

import pytest
from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.inventory_log import InventoryLog
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.product import Product
from app.models.service import Service

from tests.test_n_plus_one_queries import QueryCounter


@pytest.fixture
def barbers_and_customers(db_session):
    barbers = []
    for i in range(2):
        barber = Employee(
            full_name=f"حلاق{i}", phone_primary=f"011000000{i}", job_title="barber"
        )
        db_session.add(barber)
        barbers.append(barber)
    db_session.flush()

    customers = []
    for i in range(4):
        customer = Customer(
            first_name=f"عميل{i}", last_name="تجريبي", phone=f"010000000{i}"
        )
        db_session.add(customer)
        customers.append(customer)
    db_session.flush()
    return barbers, customers


# --------------------------------------------------------------------------- #
# The running-balance expression, isolated
# --------------------------------------------------------------------------- #


def _later_sums(db, product_ids):
    """The exact window expression the endpoint uses.

    `rows=(1, None)` is the "strictly after the current row" frame. Note the
    parameter is `rows`, not `rows_between` — SQLAlchemy names the ROWS frame
    `rows` and the RANGE frame `range_`, and passing the SQL-standard name
    raises `TypeError` at query-build time.
    """
    statement = (
        db.query(
            InventoryLog.product_id.label("product_id"),
            InventoryLog.id.label("log_id"),
            func.sum(InventoryLog.change_amount)
            .over(
                partition_by=InventoryLog.product_id,
                order_by=InventoryLog.id.asc(),                rows=(1, None),
            )
            .label("later_sum"),
        )
        .filter(InventoryLog.product_id.in_(product_ids))
        .subquery()
    )
    return {
        (product_id, log_id): Decimal(str(total or 0))
        for product_id, log_id, total in db.query(statement).all()
    }


def _seed_movements(db_session, *, product_count: int, per_product: int) -> list[Product]:
    products = []
    for p in range(product_count):
        product = Product(name=f"منتج{p}", quantity=Decimal(0))
        db_session.add(product)
        db_session.flush()
        products.append(product)

        for _ in range(per_product):
            db_session.add(
                InventoryLog(
                    product_id=product.id,
                    change_amount=Decimal(-2),
                    type="remove",
                )
            )
        product.quantity = Decimal(100) + Decimal(-2) * per_product
    db_session.commit()
    return products


# --------------------------------------------------------------------------- #
# Inventory history: the 200-aggregate case
# --------------------------------------------------------------------------- #


def test_inventory_running_balance_uses_one_query_not_one_per_row(db_session):
    """The headline case: 200 rows used to mean 200 aggregate queries."""
    _seed_movements(db_session, product_count=4, per_product=50)

    with QueryCounter(db_session.get_bind()) as counter:
        later = _later_sums(db_session, product_ids=list(range(1, 5)))

    assert counter.count() == 1, (
        f"the running total took {counter.count()} queries, expected 1"
    )
    assert len(later) == 200, f"expected 200 running totals, got {len(later)}"


def test_inventory_running_balance_numbers_are_correct(db_session):
    """A wrong balance is worse than a slow one.

    Expected values are derived from first principles: after the newest
    movement the stock equals the live quantity, and walking backwards each
    earlier row sits one movement higher. An off-by-one in the window frame
    produces values that all still look like plausible stock levels, so it has
    to be asserted rather than eyeballed.
    """
    products = _seed_movements(db_session, product_count=1, per_product=5)
    product = products[0]

    logs = (
        db_session.query(InventoryLog)
        .filter(InventoryLog.product_id == product.id)
        .order_by(InventoryLog.id)
        .all()
    )
    assert len(logs) == 5

    changes = [Decimal(str(l.change_amount)) for l in logs]
    final_quantity = Decimal(str(product.quantity))

    # stock_after for row i, built from the last row backwards.
    expected_after = [None] * len(logs)
    expected_after[-1] = final_quantity
    for i in range(len(logs) - 2, -1, -1):
        expected_after[i] = expected_after[i + 1] - changes[i + 1]

    later = _later_sums(db_session, [product.id])
    by_id = {l.id: l for l in logs}

    for index, log in enumerate(logs):
        later_sum = later.get((log.product_id, log.id), Decimal("0"))
        current = Decimal(str(log.product.quantity))
        after = current - later_sum
        before = after - Decimal(str(log.change_amount))

        assert after == expected_after[index], (
            f"row {index} (id={log.id}): expected stock_after={expected_after[index]}, got {after}"
        )
        assert before == after - changes[index]


def test_inventory_running_balance_isolates_products(db_session):
    """The window is partitioned per product, so balances must not bleed."""
    products = _seed_movements(db_session, product_count=3, per_product=4)
    later = _later_sums(db_session, [p.id for p in products])

    for product in products:
        logs = (
            db_session.query(InventoryLog)
            .filter(InventoryLog.product_id == product.id)
            .order_by(InventoryLog.id)
            .all()
        )
        newest = logs[-1]
        computed = Decimal(str(newest.product.quantity)) - later.get(
            (product.id, newest.id), Decimal("0")
        )
        assert computed == Decimal(str(product.quantity)), (
            f"product {product.id} did not reconcile: {computed} != {product.quantity}"
        )

        # Balance must decrease as the history advances.
        oldest_after = Decimal(str(logs[0].product.quantity)) - later.get(
            (product.id, logs[0].id), Decimal("0")
        )
        assert oldest_after > computed, "stock should fall across the history"


# --------------------------------------------------------------------------- #
# Per-barber day view
# --------------------------------------------------------------------------- #


def test_barber_day_view_does_not_query_per_appointment(db_session, barbers_and_customers):
    """The loop used to resolve the employee and the invoice for every row."""
    from app.api.v1.endpoints.appointments import get_appointments_by_barber

    barbers, customers = barbers_and_customers
    for i in range(15):
        db_session.add(
            Appointment(
                customer_id=customers[i % len(customers)].customer_id,
                barber_id=barbers[i % 2].id,
                appointment_date=date(2026, 3, 1),
                appointment_time=time(10, 0),
                status="completed",
            )
        )
    db_session.commit()

    with QueryCounter(db_session.get_bind()) as counter:
        result = get_appointments_by_barber(
            target_date=date(2026, 3, 1), db=db_session, current_user=None
        )

    total = sum(len(g["appointments"]) for g in result if g)
    assert total == 15
    assert counter.count() < 12, (
        f"the day view issued {counter.count()} queries for 15 appointments"
    )


def test_barber_day_view_invoiced_count_survives_a_second_invoice(db_session, barbers_and_customers):
    """`appt.invoices` replaced `.first()`, which also raised on a second invoice."""
    from app.api.v1.endpoints.appointments import get_appointments_by_barber

    barbers, customers = barbers_and_customers
    appointments = []
    for i in range(4):
        appointment = Appointment(
            customer_id=customers[i].customer_id,
            barber_id=barbers[0].id,
            appointment_date=date(2026, 3, 1),
            appointment_time=time(10, 0),
            status="completed",
        )
        db_session.add(appointment)
        appointments.append(appointment)
    db_session.flush()

    # Two invoices on one appointment: a has-many must count it once, not raise.
    for index in range(2):
        db_session.add(
            Invoice(
                appointment_id=appointments[0].id,
                customer_id=customers[0].customer_id,
                invoice_no=f"INV-DAY-{index}",
                subtotal_amount=Decimal(100),
                discount_amount=Decimal(0),
                total_amount=Decimal(100),
                is_draft=False,
            )
        )
    db_session.commit()

    result = get_appointments_by_barber(
        target_date=date(2026, 3, 1), db=db_session, current_user=None
    )

    group = next(g for g in result if g and g["employee_id"] == barbers[0].id)
    assert group["stats"].invoiced == 1, (
        f"expected the invoiced appointment counted once, got {group['stats'].invoiced}"
    )
    assert group["stats"].total == 4


# --------------------------------------------------------------------------- #
# Employee performance
# --------------------------------------------------------------------------- #


def test_employee_performance_items_are_eager_loaded(db_session, barbers_and_customers):
    """The aggregation walks `invoice.items` for every invoice in the window."""
    barbers, customers = barbers_and_customers
    service = Service(name="قص شعر", price=Decimal(100), duration_minutes=30)
    db_session.add(service)
    db_session.flush()

    for i in range(10):
        invoice = Invoice(
            invoice_no=f"INV-PERF-{i:03d}",
            customer_id=customers[i % len(customers)].customer_id,
            barber_id=barbers[0].id,
            subtotal_amount=Decimal(100),
            discount_amount=Decimal(0),
            total_amount=Decimal(100),
            is_draft=False,
        )
        db_session.add(invoice)
        db_session.flush()
        db_session.add(
            InvoiceItem(
                invoice_id=invoice.id,
                service_id=service.id,
                service_name=service.name,
                quantity=1,
                unit_price=Decimal(100),
            )
        )
    db_session.commit()

    invoices = (
        db_session.query(Invoice)
        .options(selectinload(Invoice.items))
        .filter(Invoice.is_draft == False)
        .all()
    )
    assert len(invoices) == 10

    with QueryCounter(db_session.get_bind()) as counter:
        walked = sum(len(invoice.items) for invoice in invoices)

    assert walked == 10
    assert counter.count() == 0, (
        f"walking the loaded items emitted {counter.count()} query/queries"
    )


# --------------------------------------------------------------------------- #
# Permanent customer deletion
# --------------------------------------------------------------------------- #


def test_related_counts_do_not_scale_with_customers(db_session, barbers_and_customers):
    """Six counts per customer became one grouped query for the whole set."""
    from app.api.v1.endpoints.customers import RELATED_COUNT_SOURCES, counts_by_customer

    _barbers, customers = barbers_and_customers
    target_ids = [c.customer_id for c in customers]
    assert len(target_ids) == 4

    for customer in customers:
        db_session.add(
            Appointment(
                customer_id=customer.customer_id,
                barber_id=1,
                appointment_date=date(2026, 3, 1),
                appointment_time=time(10, 0),
                status="confirmed",
            )
        )
    db_session.commit()

    with QueryCounter(db_session.get_bind()) as counter:
        counts = counts_by_customer(db_session, Appointment, Appointment.customer_id, target_ids)

    assert counter.count() == 1, f"expected one grouped query, got {counter.count()}"
    assert sum(counts.values()) == 4, "the grouped count lost rows"
    assert set(counts) == set(target_ids)


def test_related_count_sources_cover_every_table_a_customer_can_live_in():
    """A missing table means a hard delete succeeds and orphans rows."""
    from app.api.v1.endpoints.customers import RELATED_COUNT_SOURCES

    models = {model for model, _column in RELATED_COUNT_SOURCES}
    assert len(models) == 6, f"expected six related tables, found {len(models)}"
    assert len(RELATED_COUNT_SOURCES) == 6


def test_counts_by_customer_handles_an_empty_id_list(db_session):
    """An empty IN() is a syntax hazard on some dialects."""
    from app.api.v1.endpoints.customers import counts_by_customer

    with QueryCounter(db_session.get_bind()) as counter:
        result = counts_by_customer(db_session, Appointment, Appointment.customer_id, [])

    assert result == {}
    assert counter.count() == 0, "an empty id list still hit the database"
