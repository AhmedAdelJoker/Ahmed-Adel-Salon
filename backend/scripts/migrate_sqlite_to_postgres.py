"""Copies a SQLite database into an empty PostgreSQL one.

Run after `scripts/bootstrap_postgres.py`. Reads the SQLite side, writes the
PostgreSQL side, and verifies the result by row count per table.

Ordering
--------
Tables are copied in foreign-key topological order, so every referenced parent
exists before its children. Ordering is recomputed per run from the actual
metadata rather than hard-coded, so a new model is handled without editing this
file.

Cycles
------
`users` and `employees` reference each other. No ordering satisfies that, so
cycles are broken by copying the tables involved with their foreign keys
deferred, then re-asserting the constraints. On PostgreSQL that means loading
the rows inside a single transaction with the constraint added afterwards; the
simplest correct route is to insert with the FK columns nulled — every such
column in this schema is already nullable — and then write the real values back
in a second pass.

Verification
------------
A count per table on both sides, reported as a table. A mismatch aborts with a
non-zero exit, because a silent partial copy is worse than a loud failure.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, func, insert, inspect, select, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.db.base  # noqa: F401,E402
from app.db.base_class import Base  # noqa: E402

# Columns that form a known cycle and must be back-filled after the bulk load.
# Both are nullable, so a cycle can be broken without inventing values.
DEFERRED_FK_COLUMNS: dict[str, list[str]] = {
    "users": ["barber_id"],
    "employees": ["user_id"],
}


def ordered_tables() -> list:
    """Dependable ordering without adding a graph dependency.

    SQLAlchemy's own `sorted_tables` refuses to order a cyclic schema, so the
    order is derived here: every table is emitted once all of its referents that
    appear in this schema have been emitted, and anything left over (a cycle)
    is appended alphabetically so the result is at least deterministic.
    """
    names = set(Base.metadata.tables)
    deps: dict[str, set[str]] = {}
    for name, table in Base.metadata.tables.items():
        referents = set()
        for fk in table.foreign_keys:
            target = fk.column.table.name
            if target in names and target != name:
                referents.add(target)
        deps[name] = referents

    ordered: list[str] = []
    placed: set[str] = set()
    remaining = dict(deps)

    while remaining:
        ready = sorted(n for n, d in remaining.items() if d <= placed)
        if not ready:
            # A cycle. Emit the alphabetically-first member and let the deferred
            # columns carry the relationship.
            forced = sorted(remaining)[0]
            ready = [forced]
        for name in ready:
            ordered.append(name)
            placed.add(name)
            remaining.pop(name, None)

    return [Base.metadata.tables[n] for n in ordered]


def fetch_rows(source: Session, table) -> list[dict]:
    result = source.execute(select(table)).mappings().all()
    return [dict(row) for row in result]


def count_in(session: Session, table) -> int:
    """Counts through the writing session.

    Deliberately not `engine.connect()`: that opens a *second* connection, which
    cannot see the rows still inside the in-flight transaction. The first version
    did exactly that and reported every table as zero, which reads exactly like
    a total failure and is much harder to diagnose than it should be.
    """
    return session.execute(select(func.count()).select_from(table)).scalar() or 0


def count_rows(engine, table_name: str) -> int:
    """Counts through a standalone connection. Only for pre-flight reporting."""
    # Resolved through the metadata rather than interpolated into a string. The
    # table is quoted by SQLAlchemy from its own definition, so a name that is
    # not a real table raises `NoSuchTableError` instead of being pasted into a
    # statement -- and there is no identifier-shaped string anywhere in this
    # function for anyone to get wrong.
    table = Base.metadata.tables[table_name]
    with engine.connect() as conn:
        return conn.execute(select(func.count()).select_from(table)).scalar()


def copy_data(source_engine, target_engine, *, batch_size: int = 500) -> tuple[list[str], list[str]]:
    """Copies every mapped table. Returns (mismatches, skipped).

    Dialect-agnostic on purpose. The ordering, the batching and the
    cycle-breaking are all properties of the metadata, not of the wire
    protocol, so this can be exercised with two SQLite engines — which is how
    `tests/test_sqlite_to_postgres_copy.py` covers it. The PostgreSQL-specific
    half is covered separately by `verify_postgres_schema.py` and by the
    `postgresql_insert` branch in `invoices.py`.
    """
    source_tables = set(inspect(source_engine).get_table_names())
    target_tables = set(inspect(target_engine).get_table_names())
    alembic_tables = {"alembic_version", "sqlite_sequence"}

    mismatched: list[str] = []
    skipped: list[str] = []
    copied = 0

    with Session(source_engine) as source, target_engine.begin() as target_conn:
        target = Session(bind=target_conn)

        for table in ordered_tables():
            name = table.name
            if name in alembic_tables or name not in source_tables or name not in target_tables:
                skipped.append(name)
                continue

            rows = fetch_rows(source, table)
            if not rows:
                continue

            # Break the cycle. The original values are captured first: nulling
            # in place destroys them, and the second pass would then have
            # nothing to restore — which is how a copy passes its row counts
            # while quietly losing "which login belongs to this barber".
            deferred = [c for c in DEFERRED_FK_COLUMNS.get(name, []) if c in rows[0]]
            original = [
                {column: row[column] for column in deferred} for row in rows
            ]
            for row in rows:
                for column in deferred:
                    row[column] = None

            for start in range(0, len(rows), batch_size):
                target.execute(insert(table), rows[start : start + batch_size])

            if deferred:
                # Second pass: write the real references now that every row of
                # the counterpart table exists.
                target.flush()
                for row, restore in zip(rows, original):
                    updates = {c: v for c, v in restore.items() if v is not None}
                    if updates:
                        target.execute(
                            table.update().where(table.c.id == row["id"]).values(**updates)
                        )

            target.flush()
            copied += len(rows)

            expected = count_in(source, table)
            actual = count_in(target, table)
            if expected != actual:
                mismatched.append(f"{name}: source={expected} target={actual}")
            print(f"  {name:<34} {actual:>8} rows")

        target.commit()

    print(f"\ncopied {copied} rows")
    return mismatched, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", required=True, help="Path to the SQLite database to copy from.")
    parser.add_argument(
        "--target-url",
        default=None,
        help="PostgreSQL URL. Defaults to DATABASE_URL.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Rows per INSERT. 500 keeps a statement well inside the parameter limit.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be copied and exit without writing.",
    )
    args = parser.parse_args()

    from app.core.config import settings

    target_url = args.target_url or settings.DATABASE_URL
    if not target_url.startswith("postgres"):
        print(
            f"--target-url is {target_url.split('://')[0]}://, not postgres. "
            f"This script is deliberately Postgres-only: pointing it at a live "
            f"SQLite file would rewrite the data it was asked to read from.",
            file=sys.stderr,
        )
        return 2

    sqlite_path = Path(args.sqlite)
    if not sqlite_path.exists():
        print(f"no such SQLite database: {sqlite_path}", file=sys.stderr)
        return 2

    source_engine = create_engine(f"sqlite:///{sqlite_path.as_posix()}", future=True)
    target_engine = create_engine(target_url, pool_pre_ping=True, future=True)

    source_rows = sum(
        count_rows(source_engine, name)
        for name in inspect(source_engine).get_table_names()
        if not name.startswith("sqlite_") and name != "alembic_version"
    )
    print(f"source   : {sqlite_path} ({source_rows} rows)")
    print(f"target   : {target_url.split('@')[-1]}")
    print(f"tables   : {len(inspect(source_engine).get_table_names())}")

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        return 0

    mismatched, skipped = copy_data(source_engine, target_engine, batch_size=args.batch_size)

    if skipped:
        print(f"skipped {len(skipped)}: {', '.join(skipped)}")
    if mismatched:
        print(f"\nROW COUNT MISMATCH ({len(mismatched)}):")
        for line in mismatched:
            print(f"  {line}")
        return 1

    print("row counts match on every table")
    return 0


if __name__ == "__main__":
    sys.exit(main())
