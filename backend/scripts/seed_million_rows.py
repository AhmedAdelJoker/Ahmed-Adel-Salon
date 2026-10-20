"""Seeds a million rows into a real PostgreSQL database, for measuring.

Not a benchmark harness and not a fixture -- a data generator, so the plan
measurements in `measure_index_usage.py` run against a table big enough for the
planner to stop choosing a sequential scan. Every index in `c4d7e9f1a3b5` was
justified by an endpoint's query, and on a 200-row table the planner picks a seq
scan for all of them, so the justification was never actually tested.

Rows come from `generate_series` in single statements: a million rows take
seconds instead of the hours an ORM insert loop would take.

The values are skewed on purpose. Uniform data makes every index look equally
good and hides the ones that only help realistic access patterns:

  * dates spread over two years, weighted recent, because the day view and the
    auto-cancel sweep look at "now" and a uniform spread flatters date indexes;
  * `customer_id` from a small range, because real data has a few heavy
    customers, and a uniform fan-out makes composite `(customer_id, created_at)`
    indexes look better than they are;
  * `is_deleted` / `is_draft` mostly false, because the filtered listings are hot
    precisely because most rows are *not* excluded.

Not-null columns are discovered from `information_schema` and filled
generically, rather than being listed by hand. A hand-written list went stale
twice in a row here -- `employees.name` and then `employees.phone_primary` -- and
each failure only showed up as a constraint violation a third of the way through
a million-row insert. Reading the requirement from the database cannot go stale.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time

# Every table, column and size used below is a literal in this file or comes
# from `information_schema`. Identifiers are still checked before being
# interpolated, because a checker that is only ever right is not a checker.
_IDENTIFIER = re.compile(r"\A[A-Za-z_][A-Za-z0-9_]{0,62}\Z")

TABLE_SIZES = {
    "employees": 50,
    "users": 40,
    "customers": 50_000,
    "products": 2_000,
    "services": 500,
    "appointments": 400_000,
    "invoices": 300_000,
    "invoice_items": 200_000,
    "inventory_logs": 50_000,
}

# Values chosen per column where the default filler would be wrong. Everything
# else gets a type-appropriate placeholder.
EXPLICIT: dict[str, dict[str, str]] = {
    "employees": {
        "status": "'active'",
        "is_active": "true",
        "created_at": "now() - (g || ' days')::interval",
    },
    "users": {
        "hashed_password": "'x'",
        "role": "(ARRAY['owner','admin','manager','cashier','barber'])[1 + (g % 5)]",
        "is_active": "true",
        "token_version": "0",
        "created_at": "now() - (g || ' days')::interval",
        "first_login_at": "now() - (g || ' days')::interval",
    },
    "customers": {
        "visits_count": "g % 40",
        "is_deleted": "(g % 200 = 0)",
        "created_at": "now() - ((g % 730) || ' days')::interval",
    },
    "products": {
        "quantity": "100",
        "unit": "'pcs'",
        "cost_price": "10 + (g % 90)",
        "min_quantity_alert": "5",
        "is_active": "true",
        "is_archived": "(g % 300 = 0)",
        "sku": "'SKU-' || g",
        "category": "'cat-' || (g % 40)",
        "created_at": "now() - (g || ' days')::interval",
    },
    "services": {
        "price": "100 + (g % 900)",
        "duration_minutes": "30 + (g % 120)",
        "is_active": "(g % 250 <> 0)",
        "created_at": "now() - (g || ' days')::interval",
    },
    "appointments": {
        "appointment_date": "(now() - ((g % 730) || ' days')::interval)::date",
        "appointment_time": "now()::time - ((g % 480) || ' minutes')::interval",
        "status": "(ARRAY['scheduled','completed','cancelled','no_show'])[1 + (g % 4)]",
        "total_estimated_price": "100 + (g % 800)",
        "total_estimated_duration_minutes": "30 + (g % 120)",
        "confirmation_sent": "false",
        "reminder_24h_sent": "false",
        "reminder_2h_sent": "false",
        "converted_to_session": "false",
        "created_at": "now() - ((g % 730) || ' days')::interval",
        "updated_at": "now() - ((g % 730) || ' days')::interval",
    },
    "invoices": {
        "invoice_no": "'INV-' || g",
        "payment_method": "(ARRAY['cash','card','wallet'])[1 + (g % 3)]",
        "total_amount": "50 + (g % 4000)",
        "subtotal_amount": "50 + (g % 4000)",
        "discount_amount": "0",
        "is_draft": "(g % 50 = 0)",
        "status": "(ARRAY['paid','unpaid','refunded'])[1 + (g % 3)]",
        "created_at": "now() - ((g % 730) || ' days')::interval",
    },
    "invoice_items": {
        "service_name": "'Line ' || g",
        "quantity": "1",
        "unit_price": "25 + (g % 300)",
        "total_price": "25 + (g % 300)",
    },
    "inventory_logs": {
        "change_amount": "1 + (g % 20)",
        "type": "(ARRAY['add','remove'])[1 + (g % 2)]",
        "created_at": "now() - ((g % 730) || ' days')::interval",
    },
}

# Foreign keys, so the seeded data is referentially valid rather than merely
# insertable. Values are drawn from the seeded parent ranges.
FOREIGN_KEYS: dict[str, dict[str, str]] = {
    "users": {"barber_id": f"1 + (g % {TABLE_SIZES['employees']})"},
    "customers": {},
    "appointments": {
        "customer_id": f"1 + (g % {TABLE_SIZES['customers']})",
        "barber_id": f"1 + (g % {TABLE_SIZES['employees']})",
        "created_by_user_id": f"1 + (g % {TABLE_SIZES['users']})",
    },
    "invoices": {
        "customer_id": f"1 + (g % {TABLE_SIZES['customers']})",
        "appointment_id": f"1 + (g % {TABLE_SIZES['appointments']})",
        "barber_id": f"1 + (g % {TABLE_SIZES['employees']})",
        "created_by_user_id": f"1 + (g % {TABLE_SIZES['users']})",
    },
    "invoice_items": {
        "invoice_id": f"1 + (g % {TABLE_SIZES['invoices']})",
        "service_id": f"1 + (g % {TABLE_SIZES['services']})",
        # One line in three is a product sale, the rest are services. The
        # product_id index is only useful if product lines exist at all.
        "product_id": (
            f"CASE WHEN g % 3 = 0 THEN 1 + (g % {TABLE_SIZES['products']}) ELSE NULL END"
        ),
    },
    "inventory_logs": {
        "product_id": f"1 + (g % {TABLE_SIZES['products']})",
    },
    "products": {},
    "services": {},
    "employees": {},
}

# Text placeholders, keyed by the column's declared type. `g` is the row number
# from generate_series and is always in scope.
TEXT_DEFAULTS = "'x-' || g"
NUMERIC_DEFAULTS = "g"
BOOLEAN_DEFAULTS = "false"
DATE_DEFAULTS = "CURRENT_DATE"
TIMESTAMP_DEFAULTS = "now() - (g || ' days')::interval"


def _url() -> str:
    url = os.environ.get("TEST_POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not url or not url.startswith("postgres"):
        print(
            "TEST_POSTGRES_URL must point at a throwaway PostgreSQL database.\n"
            "This script TRUNCATEs every table it touches and then inserts a "
            "million rows.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return url


def _default_for(data_type: str) -> str | None:
    if data_type in ("text", "character varying", "character", "citext"):
        return TEXT_DEFAULTS
    if data_type in ("integer", "bigint", "smallint", "numeric", "decimal",
                     "real", "double precision"):
        return NUMERIC_DEFAULTS
    if data_type == "boolean":
        return BOOLEAN_DEFAULTS
    if data_type == "date":
        return DATE_DEFAULTS
    if data_type.startswith("timestamp"):
        return TIMESTAMP_DEFAULTS
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="required: this truncates the target database",
    )
    args = parser.parse_args()
    if not args.confirm:
        print("Refusing to run without --confirm: this truncates the target.")
        return 2

    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine(_url())
    started = time.perf_counter()

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        print("truncating ...", flush=True)
        conn.execute(
            sa.text(
                "TRUNCATE appointment_services, invoice_items, service_sessions, "
                "inventory_logs, appointments, invoices, customers, products, "
                "services, service_categories, employees, users, cash_transactions, "
                "expenses, notifications, activity_logs, employee_presence_logs "
                "RESTART IDENTITY CASCADE"
            )
        )

        primary_key = {
            row[0]: row[1]
            for row in conn.execute(
                sa.text(
                    """
                    SELECT table_name, column_name FROM information_schema.table_constraints
                    JOIN information_schema.key_column_usage USING (table_schema, table_name, constraint_name)
                    WHERE table_schema='public' AND constraint_type='PRIMARY KEY'
                    """
                )
            )
        }

        for table, size in TABLE_SIZES.items():
            key_column = primary_key.get(table)
            if not key_column:
                print(f"  {table}: no primary key found, skipping", flush=True)
                continue

            required = conn.execute(
                sa.text(
                    """
                    SELECT column_name, data_type FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=:t
                      AND is_nullable='NO' AND column_default IS NULL
                    """
                ),
                {"t": table},
            ).fetchall()

            explicit = dict(EXPLICIT.get(table, {}))
            explicit.update(FOREIGN_KEYS.get(table, {}))

            columns: list[str] = []
            values: list[str] = []
            for column, data_type in required:
                if column == key_column:
                    columns.append(column)
                    values.append("g")
                    continue
                if column in explicit:
                    value = explicit.pop(column)
                else:
                    value = _default_for(data_type)
                if value is None:
                    # A not-null column of a type with no sensible filler: skip it
                    # and let the database say so, rather than inserting NULL.
                    print(f"  {table}.{column} ({data_type}) has no default value; skipping")
                    continue
                columns.append(column)
                values.append(value)

            # A FK column that is not NOT NULL is still worth populating when the
            # index under test depends on it -- but only if the column actually
            # exists. `users.employee_id` does not: the link to a staff member is
            # `users.barber_id`, and naming it from memory produced
            # `UndefinedColumn` on the second table of the run. Asking the
            # catalogue is the only version of this that stays correct.
            known = {
                row[0]
                for row in conn.execute(
                    sa.text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema='public' AND table_name=:t"
                    ),
                    {"t": table},
                )
            }
            for column, value in explicit.items():
                if column in known and column not in columns:
                    columns.append(column)
                    values.append(value)

            column_sql = ", ".join(columns)
            value_sql = ", ".join(values)
            tick = time.perf_counter()
            # Table, column and value names are interpolated rather than bound.
            # They cannot be bound: they are grammar elements, not values. Every
            # one of them comes from `information_schema` or from the constants
            # at the top of this file, and each identifier is checked against
            # `_IDENTIFIER` before it gets here -- so the string-built statement
            # is built from the database's own catalogue, not from input.
            for identifier in (table, *columns):
                if not _IDENTIFIER.match(identifier):
                    raise ValueError(f"refusing to build SQL: {identifier!r} is not an identifier")
            conn.execute(
                sa.text(
                    f"INSERT INTO {table} ({column_sql}) "
                    f"SELECT {value_sql} FROM generate_series(1, {size}) g"  # nosec B608
                )
            )
            print(
                f"  {table:16} {size:>9,} rows  {time.perf_counter() - tick:6.1f}s"
                f"  ({len(columns)} cols)",
                flush=True,
            )

        # Statistics are what make the planner choose an index at all, and they
        # are only as good as the last ANALYZE. Skipping this measures a table
        # the planner has no information about, which is how a million-row table
        # ends up seq-scanned for want of a histogram.
        print("analyzing ...", flush=True)
        conn.execute(sa.text("ANALYZE"))

    total = sum(TABLE_SIZES.values())
    print(
        f"\n{total:,} rows in {time.perf_counter() - started:.1f}s "
        f"across {len(TABLE_SIZES)} tables"
    )
    engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
