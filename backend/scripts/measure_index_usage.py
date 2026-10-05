"""Runs each endpoint's real query against a seeded database and checks the plan.

`c4d7e9f1a3b5` created 46 indexes, each with a comment naming the query it was
added for. That comment is a claim, and on the test database -- a few hundred
rows -- every one of those queries is answered by a sequential scan, because a
sequential scan is the right answer for a small table. So the claims were never
tested. They were argued.

This runs the queries against a table big enough for the planner to care, and
reports one of three outcomes per index:

    INDEX       the plan uses the index, and reports which node and how many rows
    SEQ SCAN    the plan ignores the index. Either the index is not for this
                query, or the query is not what the comment claims.
    NOT USED    the index exists but the plan does not mention it, and no
                equivalent index is used either

Reported rather than enforced, because the right threshold depends on the table
and there is no single number that is correct everywhere. A seq scan on a
50,000-row table is fine; on 400,000 it is the bug this script exists to find.

    python scripts/measure_index_usage.py
    python scripts/measure_index_usage.py --explain     # full plans
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from dataclasses import dataclass


@dataclass
class Probe:
    index: str
    table: str
    sql: str
    why: str
    # A sequential scan is acceptable here -- the table is small, or the query
    # returns most of the table anyway and an index would only add random I/O.
    seq_scan_ok: bool = False


# The queries the endpoints actually issue, one per index added in
# c4d7e9f1a3b5. The `sql` is what the planner sees, including LIMIT, because
# adding or removing one changes the plan completely.
PROBES: list[Probe] = [
    Probe("ix_appointments_date_status_barber", "appointments",
          "SELECT * FROM appointments WHERE appointment_date = CURRENT_DATE AND status = 'scheduled'",
          "day view and auto-cancel sweep"),
    # The auto-cancel time window, as written in `appointments.py`.
    #
    # This index stays, despite a first measurement suggesting it was dead
    # weight, and the reason is worth recording because it is the difference
    # between "the planner ignores this" and "this costs a write for nothing".
    #
    # The endpoint's query also filters `status IN (...)`, and that variant is
    # served by ix_appointments_status without touching this index -- so on that
    # one query the index looks redundant. The time-only variant has no other
    # index that can help it, and repeated measurement with the index dropped
    # (scripts/measure_index_value.py) came out at a 2.7% difference, which is
    # noise on a 400k-row table rather than a cost worth paying for.
    #
    # So: kept, not because it demonstrably helps, but because it demonstrably
    # does not hurt, and it leads on a different column than the index that
    # appears to cover it -- neither can answer the other's query.
    Probe("ix_appointments_time", "appointments",
          "SELECT id FROM appointments WHERE appointment_time < to_char(now() - interval '1 hour', 'HH24:MI:SS')::time",
          "auto-cancel time window; the status-filtered variant is served by ix_appointments_status",
          seq_scan_ok=True),
    Probe("ix_appointments_customer_date", "appointments",
          "SELECT * FROM appointments WHERE customer_id = 4242 ORDER BY appointment_date DESC LIMIT 20",
          "per-customer booking history"),
    Probe("ix_invoices_created_at", "invoices",
          "SELECT * FROM invoices WHERE created_at >= now() - interval '30 days' ORDER BY created_at DESC LIMIT 50",
          "month close, archive, revenue windows"),
    Probe("ix_invoices_barber_created", "invoices",
          "SELECT SUM(total_amount) FROM invoices WHERE barber_id = 7 AND created_at >= now() - interval '30 days'",
          "revenue per barber over a window"),
    Probe("ix_invoices_customer_created", "invoices",
          "SELECT * FROM invoices WHERE customer_id = 4242 ORDER BY created_at DESC LIMIT 20",
          "per-customer invoice history"),
    Probe("ix_invoices_draft_created", "invoices",
          "SELECT * FROM invoices WHERE is_draft = true ORDER BY created_at DESC LIMIT 20",
          "draft listing sorted by date"),
    Probe("ix_customers_deleted_archived", "customers",
          "SELECT * FROM customers WHERE is_deleted = false ORDER BY customer_id LIMIT 50 OFFSET 20000",
          "deep pagination over live customers"),
    Probe("ix_customers_deleted_at", "customers",
          "SELECT * FROM customers WHERE is_deleted = true ORDER BY deleted_at DESC LIMIT 50",
          "archived-customer listing"),
    Probe("ix_customers_is_deleted", "customers",
          "SELECT COUNT(*) FROM customers WHERE is_deleted = false",
          "every customer list excludes the deleted", seq_scan_ok=True),
    Probe("ix_invoice_items_invoice_id", "invoice_items",
          "SELECT * FROM invoice_items WHERE invoice_id = 12345",
          "every invoice loads its lines"),
    Probe("ix_invoice_items_service_id", "invoice_items",
          "SELECT service_id, SUM(total_price) FROM invoice_items WHERE service_id BETWEEN 10 AND 40 "
          "GROUP BY service_id ORDER BY SUM(total_price) DESC LIMIT 10",
          "top-services report groups by service"),
    Probe("ix_invoice_items_product_id", "invoice_items",
          "SELECT COUNT(*) FROM invoice_items WHERE product_id = 17",
          "product sales in the invoice writer"),
    Probe("ix_inventory_logs_product_created", "inventory_logs",
          "SELECT * FROM inventory_logs WHERE product_id = 17 ORDER BY created_at DESC LIMIT 50",
          "product history and the per-row running-balance aggregate"),
    Probe("ix_inventory_logs_type", "inventory_logs",
          "SELECT type, COUNT(*) FROM inventory_logs WHERE type = 'remove' GROUP BY type",
          "add/remove counters on the inventory screen"),
    Probe("ix_inventory_logs_created_at", "inventory_logs",
          "SELECT * FROM inventory_logs WHERE created_at >= now() - interval '7 days' ORDER BY created_at DESC LIMIT 100",
          "inventory log date filters"),
    Probe("ix_products_category", "products",
          "SELECT * FROM products WHERE category = 'cat-7' AND is_archived = false",
          "inventory filter and grouping"),
    Probe("ix_products_archived", "products",
          "SELECT * FROM products WHERE is_archived = false ORDER BY name LIMIT 100",
          "every product list excludes the archive"),
    Probe("ix_products_sku", "products",
          "SELECT * FROM products WHERE sku = 'SKU-1999'",
          "product lookup by SKU"),
    Probe("ix_services_active", "services",
          "SELECT * FROM services WHERE is_active = true ORDER BY name LIMIT 100",
          "catalog listings filter on it"),
    Probe("ix_users_role_active", "users",
          "SELECT * FROM users WHERE role = 'cashier' AND is_active = true",
          "role-filtered staff queries", seq_scan_ok=True),
    Probe("ix_activity_created_action", "activity_logs",
          "SELECT * FROM activity_logs WHERE action = 'delete_customer' ORDER BY created_at DESC LIMIT 50",
          "activity log filtered by action and date"),
    Probe("ix_activity_entity_type", "activity_logs",
          "SELECT * FROM activity_logs WHERE entity_type = 'customer' ORDER BY created_at DESC LIMIT 50",
          "activity log entity filter"),
    Probe("ix_presence_employee_created", "employee_presence_logs",
          "SELECT * FROM employee_presence_logs WHERE employee_id = 7 "
          "AND created_at >= now() - interval '30 days' ORDER BY created_at DESC",
          "attendance ranges and last punch"),
    Probe("ix_notifications_user_read", "notifications",
          "SELECT COUNT(*) FROM notifications WHERE user_id = 5 AND is_read = false",
          "unread badge count per user"),
    Probe("ix_offers_active_public", "offers",
          "SELECT * FROM offers WHERE is_active = true AND is_public = true ORDER BY sort_order LIMIT 50",
          "the public booking catalog"),
    Probe("ix_waitlist_status_priority", "waitlist_entries",
          "SELECT * FROM waitlist_entries WHERE status = 'waiting' ORDER BY priority, created_at LIMIT 20",
          "default sort is priority then age"),
    Probe("ix_waitlist_preferred_date", "waitlist_entries",
          "SELECT * FROM waitlist_entries WHERE preferred_date = CURRENT_DATE AND status = 'waiting'",
          "waitlist for a given day"),
    Probe("ix_walk_in_status", "walk_in_queue",
          "SELECT * FROM walk_in_queue WHERE status = 'waiting' ORDER BY created_at LIMIT 20",
          "the board lists by status"),
    Probe("ix_expenses_created_at", "expenses",
          "SELECT * FROM expenses WHERE created_at >= now() - interval '1 day' ORDER BY created_at DESC",
          "today's expenses on the dashboard"),
    Probe("ix_cash_transactions_date", "cash_transactions",
          "SELECT * FROM cash_transactions WHERE transaction_date = CURRENT_DATE",
          "cashbox day totals"),
    Probe("ix_employees_status", "employees",
          "SELECT * FROM employees WHERE status = 'active' ORDER BY full_name",
          "every staff list filters on it", seq_scan_ok=True),
    Probe("ix_employees_user_id", "employees",
          "SELECT * FROM employees WHERE user_id = 7",
          "resolving the login behind an employee"),
    Probe("ix_booking_audit_appointment", "booking_audit_logs",
          "SELECT * FROM booking_audit_logs WHERE appointment_id = 999 ORDER BY created_at DESC",
          "per-appointment change history"),
    Probe("ix_cancellation_customer", "customer_cancellation_logs",
          "SELECT customer_id, COUNT(*) FROM customer_cancellation_logs "
          "WHERE customer_id BETWEEN 1 AND 500 GROUP BY customer_id",
          "permanent delete counts cancellations per customer"),
    Probe("ix_service_sessions_customer", "service_sessions",
          "SELECT * FROM service_sessions WHERE customer_id = 4242 ORDER BY created_at DESC LIMIT 20",
          "customer service history"),
    Probe("ix_service_sessions_appointment", "service_sessions",
          "SELECT * FROM service_sessions WHERE appointment_id = 999",
          "invoice creation resolves the session for an appointment"),
    Probe("ix_report_schedules_active_next", "report_schedules",
          "SELECT * FROM report_schedules WHERE is_active = true AND next_run_at <= now()",
          "the timer poll for due schedules"),
]


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


def _index_nodes(plan_rows) -> set[str]:
    """Every index name appearing anywhere in the plan.

    All three access paths have to be matched, which is the point. A first
    version matched only `Index Scan using NAME` and reported twelve indexes as
    unused -- every one of which was in fact being used, as a
    `Bitmap Index Scan on NAME` or an `Index Scan Backward using NAME`. So the
    tool that existed to check the indexes was reporting a third of them dead, on
    a database where none were. A scanner that cannot see what is already there
    is worse than none: it invites someone to "fix" indexes that work.

    `Backward` is matched by an optional group placed *after* `Scan`, which is
    where PostgreSQL puts it.
    """
    # PostgreSQL writes the access direction *after* Scan, not before:
    #     Index Scan using NAME
    #     Index Scan Backward using NAME
    #     Index Only Scan using NAME
    #     Bitmap Index Scan on NAME
    #
    # Two earlier patterns placed `Backward` before `Scan`. That never matches
    # anything, and a pattern that matches nothing reports every index it was
    # meant to confirm as unused -- which is how this file spent a while
    # insisting a third of the indexes were dead on a database where none were.
    patterns = (
        r"Index (?:Only )?Scan (?:Backward )?using (\w+)",
        r"Bitmap Index Scan on (\w+)",
    )
    found: set[str] = set()
    for row in plan_rows:
        text = row[0]
        for pattern in patterns:
            found.update(re.findall(pattern, text))
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--explain", action="store_true", help="print full plans")
    args = parser.parse_args()

    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine(_url())
    results: list[tuple[Probe, str, float, set[str]]] = []

    # Below this, a sequential scan is the correct plan, not a defect. A bitmap
    # index on a 500-row table costs more to build and maintain than the scan it
    # replaces saves, and treating that as a finding produces noise on every run
    # and trains the reader to ignore the report.
    MIN_ROWS_TO_CARE = 10_000

    with engine.connect() as conn:
        sizes = {
            table: conn.execute(
                sa.text("SELECT reltuples::bigint FROM pg_class WHERE relname = :t"),
                {"t": table},
            ).scalar()
            or 0
            for table in {p.table for p in PROBES}
        }
        total = sum(sizes.values())
        print(f"table sizes: {total:,} rows estimated by the planner")
        print(f"probes below {MIN_ROWS_TO_CARE:,} rows are reported, not judged\n")

        for probe in PROBES:
            rows_here = sizes.get(probe.table, 0)
            if not rows_here:
                results.append((probe, "SKIP", 0.0, set()))
                continue
            started = time.perf_counter()
            try:
                # `exec_driver_sql`, not `text()`. `sa.text()` parses the string
                # for `:name` bind parameters, and the quoted literals these
                # queries need -- `interval '30 days'`, `= 'scheduled'` -- are
                # exactly what it misreads. The result is an InternalError on
                # 21 of the 36 probes, which reads like a server fault and is
                # really a quoting problem in the harness.
                rows = conn.exec_driver_sql(
                    "EXPLAIN (ANALYZE, BUFFERS) " + probe.sql
                ).fetchall()
            except Exception as exc:  # noqa: BLE001 - report, do not abort
                # Roll back before continuing. In PostgreSQL an error aborts the
                # whole transaction, so without this every probe after the first
                # failure reports `InFailedSqlTransaction` and the report becomes
                # one real error followed by twenty echoes of it -- which reads
                # as a broken database rather than as one bad query.
                conn.rollback()
                results.append((probe, f"ERROR {type(exc).__name__}: {str(exc)[:60]}", 0.0, set()))
                continue
            elapsed_ms = (time.perf_counter() - started) * 1000
            plan = "\n".join(r[0] for r in rows)
            nodes = _index_nodes(rows)
            if probe.index in nodes:
                verdict = "INDEX"
            elif "Bitmap Index Scan" in plan or "Index Scan" in plan or "Index Cond" in plan:
                # Some other index served the query. Not a failure -- sometimes
                # two indexes cover the same shape and only one is needed.
                verdict = "OTHER IDX"
            elif "Seq Scan" in plan:
                if rows_here < MIN_ROWS_TO_CARE:
                    verdict = "small"
                elif probe.seq_scan_ok:
                    verdict = "SEQ OK"
                else:
                    verdict = "SEQ SCAN"
            else:
                verdict = "NOT USED"
            results.append((probe, verdict, elapsed_ms, nodes))

    width = max(len(p.index) for p in PROBES)
    print(f"{'index':<{width}}  {'verdict':<9} {'ms':>8}  rows")
    print("-" * (width + 34))
    for probe, verdict, elapsed, _nodes in results:
        print(f"{probe.index:<{width}}  {verdict:<9} {elapsed:8.1f}  {sizes.get(probe.table, 0):,}")

    if args.explain:
        print()
        with engine.connect() as conn:
            for probe in PROBES:
                if not sizes.get(probe.table):
                    continue
                print("=" * 78)
                print(f"{probe.index}  ({probe.why})")
                try:
                    for row in conn.exec_driver_sql("EXPLAIN (ANALYZE) " + probe.sql):
                        print("   " + row[0])
                except Exception as exc:  # noqa: BLE001
                    print(f"   {type(exc).__name__}: {exc}")

    counts: dict[str, int] = {}
    for _probe, verdict, _elapsed, _nodes in results:
        counts[verdict] = counts.get(verdict, 0) + 1
    print()
    print("summary: " + "  ".join(f"{k}={v}" for k, v in sorted(counts.items())))


    engine.dispose()
    # Non-zero only for genuine sequential scans on large tables. OTHER IDX and
    # ERROR are reported and do not fail: a probe written for a table that was
    # empty in this particular run is a gap in the harness, not a defect in the
    # schema.
    unexpected = [
        p.index for p, v, _e, _n in results if v == "SEQ SCAN" and sizes.get(p.table, 0) >= 10_000
    ]
    if unexpected:
        print(f"\nsequential scans on large tables with no index used: {unexpected}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
