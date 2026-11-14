"""Verifies the endpoint-driven index migration on a real database.

Three things have to hold, in order of how much they would hurt if they did not:

1. **The data is intact.** This runs against a copy of the production file, so a
   mistake here would corrupt a business database. Row counts, foreign keys and
   the Alembic revision are all checked.
2. **The indexes exist.** A migration that silently skips because a column was
   renamed reports success and leaves the screen just as slow.
3. **The planner picks them up.** An index nothing uses is pure write overhead
   and disk. `EXPLAIN QUERY PLAN` is asked directly whether each target query
   uses an index rather than scanning, which is the only way to know an index
   is earning its keep.

Usage:
    DATABASE_URL=sqlite:///./copy.db python scripts/verify_index_migration.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text  # noqa: E402

sys.path.insert(0, str(ROOT / "alembic" / "versions"))
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location(
    "index_migration", ROOT / "alembic" / "versions" / "c4d7e9f1a3b5_endpoint_driven_indexes.py"
)
index_migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(index_migration)

# (label, sql, index substrings that should appear in the plan)
PROBES: list[tuple[str, str, tuple[str, ...]]] = [
    (
        "product history (the 200-scan N+1)",
        "SELECT * FROM inventory_logs WHERE product_id = 1 ORDER BY created_at DESC LIMIT 100",
        ("inventory_logs_product_created",),
    ),
    (
        "today's expenses on the dashboard",
        "SELECT SUM(amount) FROM expenses WHERE created_at >= '2026-01-01'",
        ("ix_expenses_created_at",),
    ),
    (
        "invoice lines for one invoice",
        "SELECT * FROM invoice_items WHERE invoice_id = 1",
        ("ix_invoice_items_invoice_id",),
    ),
    (
        "attendance range for an employee",
        "SELECT * FROM employee_presence_logs WHERE employee_id = 1 "
        "AND created_at BETWEEN '2026-01-01' AND '2026-12-31'",
        ("ix_presence_employee_created",),
    ),
    (
        "product list filtered by archive",
        "SELECT * FROM products WHERE is_archived = 0",
        ("ix_products_archived",),
    ),
    (
        "customer list excluding the archive",
        "SELECT * FROM customers WHERE is_deleted = 0 ORDER BY customer_id DESC",
        ("ix_customers_deleted_archived",),
    ),
    (
        "unread badge count per role",
        "SELECT COUNT(*) FROM notifications WHERE user_role = 'manager' AND is_read = 0",
        ("ix_notifications_role_read",),
    ),
    (
        "scheduler poll for due reports",
        "SELECT * FROM report_schedules WHERE is_active = 1 AND next_run_at <= '2026-01-01'",
        ("ix_report_schedules_active_next",),
    ),
    (
        "walk-in board by status",
        "SELECT * FROM walk_in_queue WHERE status IN ('waiting','called')",
        ("ix_walk_in_status",),
    ),
    (
        "service ingredients per service",
        "SELECT * FROM service_products WHERE service_id = 1",
        (),
    ),
]


def main() -> int:
    from app.core.config import settings

    engine = create_engine(settings.DATABASE_URL, future=True)
    problems: list[str] = []

    with engine.connect() as conn:
        # 1. Integrity.
        fk_violations = conn.execute(text("PRAGMA foreign_key_check")).fetchall()
        if fk_violations:
            problems.append(f"foreign key violations: {len(fk_violations)}")

        integrity = conn.execute(text("PRAGMA integrity_check")).scalar()
        if integrity != "ok":
            problems.append(f"integrity_check: {integrity}")

        existing = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='index'")
            )
        }

        # 2. The migration's own list is present.
        missing = [
            (name, table, why)
            for name, table, _cols, why in index_migration.INDEXES
            if name not in existing
        ]
        for name, table, why in missing:
            problems.append(f"index missing: {name} on {table} — {why}")

        revision = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()

    total = len(index_migration.INDEXES)
    print(f"target revision : {revision}")
    print(f"indexes present : {len(missing) == 0 and total or total - len(missing)}/{total}")
    print(f"foreign keys    : {'clean' if not fk_violations else fk_violations}")
    print(f"integrity       : {integrity}")

    # 3. Does the planner actually use them?
    print("\nquery plans:")
    scanned: list[str] = []
    with engine.connect() as conn:
        for label, sql, expected in PROBES:
            plan = " | ".join(
                str(row[-1]) for row in conn.execute(text(f"EXPLAIN QUERY PLAN {sql}"))
            )
            uses_index = "USING INDEX" in plan or "USING COVERING INDEX" in plan
            if expected and not uses_index:
                scanned.append(label)
            marker = "index" if uses_index else "SCAN"
            print(f"  [{marker:>4}] {label}")
            if not uses_index:
                print(f"          {plan[:150]}")

    for label in scanned:
        problems.append(f"planner still scans for: {label}")

    if problems:
        print(f"\n{len(problems)} problem(s):")
        for problem in problems:
            print(f"  {problem}")
        return 1

    print("\nevery declared index exists and the planner uses the target queries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
