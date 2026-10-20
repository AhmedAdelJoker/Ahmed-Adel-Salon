"""Proves the N+1 is gone by counting queries, not by inspecting the code.

An N+1 is invisible to every other kind of check. The response is byte-for-byte
identical before and after the fix, typecheck passes, the tests pass, and
`EXPLAIN` on any single statement looks fine. The only symptom is elapsed time
and database load, which is exactly what nobody notices until production.

So these tests count the statements the session actually emits. A regression
here is loud and immediate: the count goes from 3 back to 2N+1.
"""

from datetime import date, time

import pytest
from sqlalchemy import event
from sqlalchemy.engine import Engine

from app.db.session import SessionLocal
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.waitlist_entry import WaitlistEntry


class QueryCounter:
    """Counts SELECTs emitted on one engine.

    Attached to the engine rather than the session, so a lazy load triggered
    mid-serialisation is counted just like a top-level query — which is the
    whole point, since the lazy load is the bug.
    """

    def __init__(self, engine: Engine):
        self.engine = engine
        self.statements: list[str] = []

    def _on_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        text = statement.strip().split("\n")[0][:120]
        self.statements.append(text)

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self._on_cursor_execute)
        return self

    def __exit__(self, *exc):
        event.remove(self.engine, "before_cursor_execute", self._on_cursor_execute)
        return False

    def count(self, fragment: str | None = None) -> int:
        if fragment is None:
            return len(self.statements)
        return sum(1 for s in self.statements if fragment.lower() in s.lower())


@pytest.fixture
def dataset(db_session):
    """Three customers, two barbers, and a page's worth of appointments."""
    customers = []
    for i in range(3):
        customer = Customer(first_name=f"عميل{i}", last_name="تجريبي", phone=f"010000000{i}")
        db_session.add(customer)
        customers.append(customer)
    db_session.flush()

    barbers = []
    for i in range(2):
        barber = Employee(full_name=f"حلاق{i}", phone_primary=f"011000000{i}")
        db_session.add(barber)
        barbers.append(barber)
    db_session.flush()

    appointments = []
    for i in range(12):
        appointment = Appointment(
            customer_id=customers[i % len(customers)].customer_id,
            barber_id=barbers[i % len(barbers)].id,
            appointment_date=date(2026, 3, 1),
            appointment_time=time(10, 0),
            status="confirmed",
        )
        db_session.add(appointment)
        appointments.append(appointment)

    for i in range(9):
        db_session.add(
            WaitlistEntry(
                customer_id=customers[i % len(customers)].customer_id,
                barber_id=barbers[i % len(barbers)].id,
                status="waiting",
                priority=i % 3,
                preferred_date=date(2026, 3, 1),
            )
        )

    db_session.commit()
    return {"customers": customers, "barbers": barbers, "appointments": appointments}


def test_appointment_list_query_count_is_constant(db_session, dataset):
    """Three queries for the page, regardless of how many rows it has."""
    from app.api.v1.endpoints.appointments import (
        _appointment_to_read,
        appointment_eager_options,
    )

    def run(rows: int) -> int:
        with QueryCounter(db_session.get_bind()) as counter:
            query = (
                db_session.query(Appointment)
                .options(*appointment_eager_options())
                .limit(rows)
            )
            result = [_appointment_to_read(db_session, row) for row in query.all()]
            assert len(result) == rows
            return counter.count()

    small = run(3)
    large = run(12)

    # The relationship loads must not scale with the row count.
    assert large <= small + 1, (
        f"query count grew with the page size: {small} for 3 rows, "
        f"{large} for 12 — the N+1 is back"
    )
    assert small <= 6, f"expected a handful of queries, got {small}"


def test_appointment_serializer_alone_emits_no_queries(db_session, dataset):
    """Serialising already-loaded rows must not touch the database at all.

    This is the sharpest form of the assertion: the rows are fetched and the
    counter is attached afterwards, so anything the serializer needs has to come
    from the relationship cache.
    """
    from app.api.v1.endpoints.appointments import (
        _appointment_to_read,
        appointment_eager_options,
    )

    rows = (
        db_session.query(Appointment)
        .options(*appointment_eager_options())
        .limit(6)
        .all()
    )
    assert len(rows) == 6

    with QueryCounter(db_session.get_bind()) as counter:
        serialised = [_appointment_to_read(db_session, row) for row in rows]

    assert len(serialised) == 6
    assert counter.count() == 0, (
        f"the serializer issued {counter.count()} query/queries: "
        f"{counter.statements[:3]}"
    )


def test_serialised_output_is_unchanged(db_session, dataset):
    """The fix must not alter a single field.

    A performance change that quietly drops `customer_name` is worse than the
    N+1, so the payload is asserted rather than assumed.
    """
    from app.api.v1.endpoints.appointments import (
        _appointment_to_read,
        appointment_eager_options,
    )

    rows = (
        db_session.query(Appointment)
        .options(*appointment_eager_options())
        .order_by(Appointment.id)
        .limit(4)
        .all()
    )
    serialised = [_appointment_to_read(db_session, row) for row in rows]

    for row, read in zip(rows, serialised):
        customer = db_session.get(Customer, row.customer_id)
        barber = db_session.get(Employee, row.barber_id)
        assert read.customer_name == f"{customer.first_name} {customer.last_name}".strip()
        assert read.customer_phone == customer.phone
        assert read.barber_name == (barber.display_name or barber.full_name)
        assert read.id == row.id
        assert read.status == row.status


def test_waitlist_list_query_count_is_constant(db_session, dataset):
    from app.api.v1.endpoints.waitlist import _waitlist_to_read, waitlist_eager_options

    def run(rows: int) -> int:
        with QueryCounter(db_session.get_bind()) as counter:
            query = (
                db_session.query(WaitlistEntry)
                .options(*waitlist_eager_options())
                .limit(rows)
            )
            assert len([_waitlist_to_read(db_session, r) for r in query.all()]) == rows
            return counter.count()

    small = run(3)
    large = run(9)

    assert large <= small + 1, (
        f"waitlist query count grew with the page: {small} → {large}"
    )


def test_waitlist_serializer_alone_emits_no_queries(db_session, dataset):
    from app.api.v1.endpoints.waitlist import _waitlist_to_read, waitlist_eager_options

    rows = (
        db_session.query(WaitlistEntry).options(*waitlist_eager_options()).limit(6).all()
    )
    assert len(rows) == 6

    with QueryCounter(db_session.get_bind()) as counter:
        serialised = [_waitlist_to_read(db_session, row) for row in rows]

    assert len(serialised) == 6
    assert counter.count() == 0, (
        f"the waitlist serializer issued {counter.count()} query/queries"
    )


def test_a_missing_customer_does_not_break_serialisation(db_session, dataset):
    """The relationship is None rather than an exception, and that is handled.

    An appointment whose customer or barber row is gone used to come back with
    the "unknown" fallback; that has to keep working, and it must not turn into
    a query either.

    The relationship is cleared in memory rather than by deleting rows, because
    a hard delete would be refused by the foreign key and the scenario being
    tested is "the row is not there", not "the delete succeeded".
    """
    from app.api.v1.endpoints.appointments import (
        _appointment_to_read,
        appointment_eager_options,
    )

    rows = (
        db_session.query(Appointment)
        .options(*appointment_eager_options())
        .limit(1)
        .all()
    )
    row = rows[0]

    # Simulate the row not being resolvable, without touching the database.
    row.customer = None
    row.barber = None

    with QueryCounter(db_session.get_bind()) as counter:
        read = _appointment_to_read(db_session, row)

    assert read.customer_name == "عميل مجهول"
    assert read.customer_phone is None
    assert read.barber_name == "غير محدد"
    assert counter.count() == 0, "the fallback path issued a query"


def test_the_guard_would_catch_a_reintroduced_n_plus_one(db_session, dataset):
    """Proves the guard has teeth.

    A regression test that has never failed is not known to work. This
    reintroduces the original pattern — a per-row query instead of the
    relationship — and asserts the counter notices. If this test ever passes
    with the broken serializer, the whole file is measuring nothing.
    """
    from sqlalchemy.orm import Session


    rows = (
        db_session.query(Appointment).options(*_eager()).limit(6).all()
    )
    assert len(rows) == 6

    def broken_serializer(db: Session, appointment: Appointment) -> dict:
        # The pre-fix body: two queries per row, regardless of eager loading.
        customer = db.query(Customer).filter(
            Customer.customer_id == appointment.customer_id
        ).first()
        barber = db.query(Employee).filter(Employee.id == appointment.barber_id).first()
        return {
            "id": appointment.id,
            "customer_name": f"{customer.first_name} {customer.last_name}".strip(),
            "barber_name": barber.full_name,
        }

    with QueryCounter(db_session.get_bind()) as counter:
        [broken_serializer(db_session, row) for row in rows]

    assert counter.count() == 12, (
        f"expected 12 queries from the per-row pattern, saw {counter.count()}"
    )
    assert counter.count() > 6, "the counter is not detecting per-row queries at all"


def _eager():
    from app.api.v1.endpoints.appointments import appointment_eager_options

    return appointment_eager_options()