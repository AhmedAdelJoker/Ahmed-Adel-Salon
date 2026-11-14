"""Measures whether a named index earns its write cost, by dropping it.

`measure_index_usage.py` answers "does the planner use this index". That is not
the same question as "is this index worth keeping", and the difference is not
academic. ix_appointments_time looked like dead weight -- the auto-cancel query
filters on `status IN (...)` too, and the planner reaches the rows through
ix_appointments_status without touching it.

This script makes the trade-off measurable: it runs each query with and without
the index and prints the difference. Nothing is dropped permanently; the index is
recreated before exit and its presence is verified afterwards, because a
measurement tool that can leave a production schema missing an index is not a
tool anyone should point at staging.

Read the results sceptically
---------------------------
The numbers move. Three consecutive runs of the same query against the same
400k-row table, minutes apart, gave -25 ms, -78 ms and +348 ms -- the third
saying the index is a large net cost, the first two saying it is a small net
benefit. The `ANALYZE` between runs recomputes the planner's statistics, and a
sequential scan over 400k rows is exactly the case where the cost estimate sits
on a knife edge. A single delta from this script is not evidence of anything.

What it is good for: ruling an index *out* when it is consistently many times
worse, and seeing whether a query you did not think of changes shape when the
index is there. What it cannot do: justify dropping an index on a 30% swing.

For a decision you intend to act on, re-run it several times, ignore any
individual run, and prefer the plan (`Seq Scan` versus the index name) over the
milliseconds.

    python scripts/measure_index_value.py --index ix_invoices_created_at --table invoices \\
        --query "SELECT * FROM invoices WHERE created_at >= now() - interval '30 days' ORDER BY created_at DESC LIMIT 50"
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from contextlib import contextmanager

_IDENTIFIER = re.compile(r"\A[A-Za-z_][A-Za-z0-9_]{0,62}\Z")

# The `nosec B608` markers below are not blanket suppressions. `exec_driver_sql`
# takes driver SQL and DDL has to be string-built -- an index name, a table name
# and a column list are grammar elements and cannot be bind parameters. Every one
# of them is checked against `_IDENTIFIER` before reaching a statement, and the
# script refuses to run if any fails. What remains is a name drawn from a
# character class of letters, digits and underscores, which cannot carry a
# semicolon, a quote or a space.


def _url() -> str:
    url = os.environ.get("TEST_POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not url or not url.startswith("postgres"):
        print(
            "TEST_POSTGRES_URL must point at a seeded PostgreSQL database. "
            "Run scripts/seed_million_rows.py --confirm first.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return url


@contextmanager
def index_absent(conn, index: str, table: str, columns: str):
    """Drops the index for the duration, and always puts it back.

    The column list is passed in rather than read back inside, because by the
    time this runs the index no longer exists and `pg_indexes` has nothing to
    describe. Reading it after the drop is the obvious thing to write and it
    fails with "ix_... does not exist" on the very first query -- which is what
    happened, and it reads like a broken seed rather than a broken script.

    The restore is in a `finally` because the alternative is leaving a production
    schema missing an index because a measurement script was interrupted, which
    is the kind of damage a measurement tool should not be able to do.
    """
    conn.exec_driver_sql(f'DROP INDEX IF EXISTS "{index}"')  # nosec B608
    conn.commit()
    conn.exec_driver_sql(f"ANALYZE {table}")  # nosec B608
    try:
        yield
    finally:
        conn.exec_driver_sql(
            f'CREATE INDEX IF NOT EXISTS "{index}" ON {table} USING btree ({columns})'  # nosec B608
        )
        conn.commit()
        conn.exec_driver_sql(f"ANALYZE {table}")  # nosec B608


def _measure(conn, sql: str, repeats: int = 3) -> tuple[float, str]:
    """Median of `repeats` runs, plus the plan text.

    Median because the first call after an ANALYZE pays for a cold cache, and
    because a sequential scan over a large table has a cost estimate close enough
    to the boundary that single runs flip sign.
    """
    repeats = max(1, repeats)
    timings = []
    plan = ""
    for _ in range(repeats):
        started = time.perf_counter()
        rows = conn.exec_driver_sql("EXPLAIN (ANALYZE) " + sql).fetchall()
        timings.append((time.perf_counter() - started) * 1000)
        plan = "\n".join(r[0] for r in rows)
    timings.sort()
    return timings[len(timings) // 2], plan


def _used(plan: str, index: str) -> bool:
    return bool(
        re.search(
            rf"Index (?:Only )?Scan (?:Backward )?using {re.escape(index)}"
            rf"|Bitmap Index Scan on {re.escape(index)}",
            plan,
        )
    )


def _rows(conn, table: str) -> int:
    return conn.exec_driver_sql(
        f"SELECT reltuples::bigint FROM pg_class WHERE relname='{table}'"  # nosec B608
    ).scalar() or 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", required=True)
    parser.add_argument("--table", required=True)
    parser.add_argument(
        "--query",
        action="append",
        required=True,
        help="repeatable; each is measured with and without the index",
    )
    parser.add_argument(
        "--expect-columns",
        default=None,
        help="column list for recreating the index if it is missing, e.g. 'appointment_time'. "
        "Without it the script can only measure an index that already exists.",
    )
    parser.add_argument(
        "--repeats",
        type=int,
        default=3,
        help="runs per side; the median is reported. Below 3 the numbers are not "
        "reproducible -- three runs of one query on a 400k-row table gave -25ms, "
        "-78ms and +348ms.",
    )
    args = parser.parse_args()

    for name, value in (("index", args.index), ("table", args.table)):
        if not _IDENTIFIER.match(value):
            print(f"refusing to build SQL: {name} {value!r} is not an identifier")
            return 2
    if args.expect_columns:
        for column in args.expect_columns.split(","):
            if not _IDENTIFIER.match(column.strip()):
                print(f"refusing to build SQL: column {column!r} is not an identifier")
                return 2

    from sqlalchemy import create_engine

    engine = create_engine(_url())
    print(f"{args.index} on {args.table}", flush=True)

    with engine.connect() as conn:
        exists = conn.exec_driver_sql(
            "SELECT 1 FROM pg_indexes WHERE schemaname='public' "
            f"AND indexname='{args.index}'"  # nosec B608
        ).fetchone()
        columns = args.expect_columns
        if not exists:
            if not columns:
                print(
                    f"{args.index} does not exist. Pass --expect-columns with the "
                    "column list to have it created first."
                )
                engine.dispose()
                return 2
            conn.exec_driver_sql(
                f'CREATE INDEX "{args.index}" ON {args.table} USING btree ({columns})'
            )
            conn.commit()
            print(f"  created {args.index} ({columns}) so there is something to measure")
        else:
            # Read the real column list so the recreate is exact rather than
            # whatever the caller remembered to pass.
            row = conn.exec_driver_sql(
                "SELECT indexdef FROM pg_indexes WHERE schemaname='public' "
                f"AND indexname='{args.index}'"  # nosec B608
            ).fetchone()
            match = re.search(r"USING btree \(([^)]*)\)", row[0]) if row else None
            if match is None:
                print(f"cannot parse the column list of {args.index}")
                engine.dispose()
                return 2
            columns = match.group(1)

        size = _rows(conn, args.table)
        print(f"table has ~{size:,} rows\n")
        if size < 10_000:
            print(
                "WARNING: below ~10,000 rows the planner answers almost anything "
                "with a sequential scan, so both sides of this comparison will "
                "look the same. Seed a larger dataset for a meaningful result.\n"
            )

        print(f"{'query':<58} {'with':>9} {'without':>9} {'delta':>9}  plan w/o")
        print("-" * 118)
        for sql in args.query:
            label = " ".join(sql.split())[:56]
            with_ms, with_plan = _measure(conn, sql, args.repeats)
            with index_absent(conn, args.index, args.table, columns):
                without_ms, without_plan = _measure(conn, sql, args.repeats)
            # Confirm the restore actually happened; a silent failure here would
            # leave the database without the index and every later measurement
            # would be comparing the wrong thing.
            still_there = conn.exec_driver_sql(
                "SELECT 1 FROM pg_indexes WHERE schemaname='public' "
                f"AND indexname='{args.index}'"  # nosec B608
            ).fetchone()
            if not still_there:
                print(f"  ERROR: {args.index} was not restored; re-run the migration")
                engine.dispose()
                return 1

            delta = without_ms - with_ms
            if with_ms > 1 and delta > 1:
                direction = "faster without"
            elif with_ms > 1 and delta < -1:
                direction = "faster with"
            else:
                direction = "no difference"
            scan = next(
                (ln.strip() for ln in without_plan.splitlines() if "Scan" in ln), ""
            )
            print(
                f"{label:<58} {with_ms:8.1f}ms {without_ms:8.1f}ms "
                f"{delta:+8.1f}ms  {scan[:44]}"
            )
            print(
                f"{'':<58} {'':<9} {'':<9} {'':<9}  -> {direction}"
                f"{' (index used)' if _used(with_plan, args.index) else ''}"
            )

    engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
