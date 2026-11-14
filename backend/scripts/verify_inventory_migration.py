"""Verifies the clean-room migration result for inventory idempotency.

Kept as a script rather than an ad-hoc command so the exact assertions that
guard the schema are reviewable and repeatable.
"""

import os
import sqlite3
import sys

DB = os.environ.get("ALEMBIC_TEST_DB")
if not DB:
    print("ALEMBIC_TEST_DB is not set", file=sys.stderr)
    sys.exit(2)

conn = sqlite3.connect(DB)

columns = {r[1] for r in conn.execute("PRAGMA table_info(inventory_logs)")}
indexes = sorted(
    r[0]
    for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='inventory_logs'"
    )
)
ddl = conn.execute(
    "SELECT sql FROM sqlite_master WHERE name='inventory_logs'"
).fetchone()
fk_violations = conn.execute("PRAGMA foreign_key_check").fetchall()

checks = [
    ("source_type column added", "source_type" in columns),
    ("source_id column added", "source_id" in columns),
    ("index on source_type", "ix_inventory_logs_source_type" in indexes),
    ("index on source_id", "ix_inventory_logs_source_id" in indexes),
    (
        "unique constraint created",
        "uq_inventory_logs_source_product" in (ddl[0] if ddl else ""),
    ),
    ("foreign keys intact", not fk_violations),
]

width = max(len(name) for name, _ in checks)
for name, ok in checks:
    print(f"  {'OK  ' if ok else 'FAIL'} {name.ljust(width)}")

failed = [name for name, ok in checks if not ok]
if failed:
    print(f"\n{len(failed)} schema check(s) failed")
    sys.exit(1)
print("\nall schema checks passed")
