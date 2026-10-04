"""Exercises the SQLite → target copy without needing a PostgreSQL server.

There is no Postgres in this environment, so the real thing cannot be run here.
What *can* be verified is everything the copy script is responsible for, because
none of it is dialect-specific:

* the topological ordering, including the `users`/`employees` cycle;
* batched inserts;
* the deferred-column two-pass that breaks the cycle;
* the row-count verification that turns a partial copy into a loud failure.

The CLI stays Postgres-only on purpose — pointing it at a live SQLite file would
rewrite the very data it was asked to read — so these tests drive `copy_data`
directly against a second SQLite file. The PostgreSQL half of the move is
covered separately by `verify_postgres_schema.py` and by the `postgresql_insert`
branch in `invoices.py`.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

import app.db.base  # noqa: F401,E402
from app.db.base_class import Base  # noqa: E402
from migrate_sqlite_to_postgres import copy_data, ordered_tables  # noqa: E402

SCRIPT = ROOT / "scripts" / "migrate_sqlite_to_postgres.py"


def _seed(db: Session) -> None:
    """A small dataset that exercises every relationship shape we care about."""
    from app.models.customer import Customer
    from app.models.employee import Employee
    from app.models.invoice import Invoice
    from app.models.inventory_log import InventoryLog
    from app.models.product import Product
    from app.models.user import User

    # The cycle: a user who is also a barber, and that barber's login.
    user = User(username="owner", hashed_password="x", role="owner")
    db.add(user)
    db.flush()

    employee = Employee(full_name="أحمد", phone_primary="01000000001")
    db.add(employee)
    db.flush()

    # Both directions, so the two-pass back-fill has real work to do.
    employee.user_id = user.id
    user.barber_id = employee.id
    db.flush()

    for i in range(5):
        db.add(Customer(first_name=f"عميل{i}", last_name="تجريبي", phone=f"0100000001{i}"))
    db.flush()

    for i in range(3):
        db.add(Product(name=f"منتج{i}", quantity=10))
    db.flush()

    for i, customer in enumerate(db.query(Customer).all()):
        db.add(
            Invoice(
                invoice_no=f"INV-TEST-{i:04d}",
                customer_id=customer.customer_id,
                subtotal_amount=100,
                discount_amount=0,
                total_amount=100,
                barber_id=employee.id,
            )
        )
    db.flush()

    for product in db.query(Product).all():
        db.add(InventoryLog(product_id=product.id, change_amount=-1, type="remove"))
    db.flush()


@pytest.fixture
def databases(tmp_path):
    source_path = tmp_path / "source.db"
    target_path = tmp_path / "target.db"

    source_engine = create_engine(f"sqlite:///{source_path.as_posix()}")
    Base.metadata.create_all(source_engine)
    with Session(source_engine) as db:
        _seed(db)
        db.commit()

    target_engine = create_engine(f"sqlite:///{target_path.as_posix()}")
    Base.metadata.create_all(target_engine)

    return source_path, target_path, source_engine, target_engine


def _copy(source_path: Path, target_path: Path, batch_size: int = 500):
    source_engine = create_engine(f"sqlite:///{source_path.as_posix()}")
    target_engine = create_engine(f"sqlite:///{target_path.as_posix()}")
    mismatched, _skipped = copy_data(source_engine, target_engine, batch_size=batch_size)
    assert not mismatched, "row counts diverged:\n" + "\n".join(mismatched)


def _shared_tables(source_engine, target_engine) -> list[str]:
    source = set(inspect(source_engine).get_table_names())
    target = set(inspect(target_engine).get_table_names())
    return sorted(
        name
        for name in source & target
        if not name.startswith("sqlite_") and name != "alembic_version"
    )


# --------------------------------------------------------------------------- #
# Ordering
# --------------------------------------------------------------------------- #


def test_ordering_places_parents_before_children():
    """`invoices` references `customers`, so customers must come first."""
    names = [t.name for t in ordered_tables()]

    assert len(names) == len(set(names)), "a table appeared twice in the ordering"
    assert len(names) == len(Base.metadata.tables), "a mapped table was dropped"

    for table_name, parent in (("invoices", "customers"), ("inventory_logs", "products")):
        assert names.index(parent) < names.index(table_name), (
            f"{parent} must be copied before {table_name}"
        )


def test_ordering_is_deterministic():
    """Two runs must produce the same order, or a partial re-run differs."""
    first = [t.name for t in ordered_tables()]
    second = [t.name for t in ordered_tables()]
    assert first == second


# --------------------------------------------------------------------------- #
# Copy
# --------------------------------------------------------------------------- #


def test_copy_preserves_every_row_count(databases):
    source_path, target_path, source_engine, target_engine = databases

    _copy(source_path, target_path)

    mismatches = []
    for name in _shared_tables(source_engine, target_engine):
        with source_engine.connect() as a, target_engine.connect() as b:
            left = a.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
            right = b.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
        if left != right:
            mismatches.append(f"{name}: {left} != {right}")

    assert not mismatches, "row counts diverged:\n" + "\n".join(mismatches)


def test_copy_preserves_the_employee_user_cycle(databases):
    """Both directions must survive, not just the row counts.

    A copy that nulled the cycle columns and never restored them would pass a
    count check while silently losing "which login belongs to this barber" —
    which is how an employee ends up unable to sign in.
    """
    source_path, target_path, _source, target_engine = databases

    _copy(source_path, target_path)

    with target_engine.connect() as conn:
        employee = conn.execute(
            text("SELECT id, full_name, user_id FROM employees")
        ).mappings().all()
        user = conn.execute(
            text("SELECT id, username, barber_id FROM users")
        ).mappings().all()

    assert len(employee) == 1
    assert len(user) == 1
    assert employee[0]["user_id"] is not None, "employees.user_id was not back-filled"
    assert user[0]["barber_id"] is not None, "users.barber_id was not back-filled"
    assert user[0]["barber_id"] == employee[0]["id"]
    assert employee[0]["user_id"] == user[0]["id"]


def test_copy_preserves_invoice_values_not_just_counts(databases):
    """The numbers people rely on must come across identical."""
    source_path, target_path, source_engine, target_engine = databases

    _copy(source_path, target_path)

    query = "SELECT invoice_no, customer_id, total_amount FROM invoices ORDER BY invoice_no"
    with source_engine.connect() as a, target_engine.connect() as b:
        left = [tuple(r) for r in a.execute(text(query)).all()]
        right = [tuple(r) for r in b.execute(text(query)).all()]

    assert len(left) == 5
    assert left == right


def test_copy_is_batched_without_losing_rows(databases):
    """A batch size of 2 forces the multi-chunk path over 5 customers."""
    source_path, target_path, _source, target_engine = databases

    _copy(source_path, target_path, batch_size=2)

    with target_engine.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM customers")).scalar() == 5


def test_copy_reports_a_shortfall_rather_than_claiming_success(databases, monkeypatch):
    """A count mismatch must surface, so the CLI can exit non-zero.

    A silently partial copy of a business database is worse than a failed one:
    the operator finds out at the moment the missing rows mattered, usually a
    month later.

    The mismatch is injected rather than staged, because a real shortfall is hard
    to produce without corrupting the target first — and corrupting it is exactly
    what this test exists to make sure the script notices.
    """
    import migrate_sqlite_to_postgres as copier

    real_count = copier.count_in
    source_path, target_path, _source, _target = databases
    calls: dict[str, int] = {}

    def skewed(session, table):
        """`copy_data` counts source-then-target, so the call parity tells the
        two apart. Skewing the second call is a guaranteed asymmetry; skewing by
        session identity would need `get_bind()`, which returns the Connection
        rather than the Engine."""
        value = real_count(session, table)
        calls[table.name] = calls.get(table.name, 0) + 1
        return value + 7 if table.name == "customers" and calls[table.name] == 2 else value

    monkeypatch.setattr(copier, "count_in", skewed)

    mismatched, _skipped = copier.copy_data(
        create_engine(f"sqlite:///{source_path.as_posix()}"),
        create_engine(f"sqlite:///{target_path.as_posix()}"),
    )

    assert mismatched, "a row-count shortfall was not reported"
    assert any("customers" in line for line in mismatched), (
        f"the report did not name the table: {mismatched}"
    )


# --------------------------------------------------------------------------- #
# CLI guards
# --------------------------------------------------------------------------- #


def _run_cli(*args) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )


def test_cli_refuses_a_sqlite_target(databases):
    """Pointing it at a live SQLite file would rewrite the source data."""
    source_path, target_path, _source, _target = databases

    result = _run_cli(
        "--sqlite", str(source_path),
        "--target-url", f"sqlite:///{target_path.as_posix()}",
    )

    assert result.returncode == 2
    assert "not postgres" in result.stderr


def test_cli_reports_a_missing_source():
    result = _run_cli(
        "--sqlite", "definitely-not-here.db",
        "--target-url", "postgresql+psycopg2://u:p@localhost:5432/x",
    )

    assert result.returncode == 2
    assert "no such SQLite database" in result.stderr
