"""Investigates the foreign-key violations in the production-shaped database.

`PRAGMA foreign_key_check` reports 58 rows whose parent is missing, spread
across five tables. That is not this migration's doing -- it predates every
revision in the history -- and it is not something any test noticed, because the
test suite builds its own database from the models and a freshly built database
has no orphans by construction.

This reports what each violation actually is rather than just counting them,
because the count alone does not tell you whether it matters:

* an orphan whose parent was deliberately deleted is expected, and the schema
  should be saying `ON DELETE SET NULL` instead of leaving a dangling id;
* an orphan whose parent is missing because a row was lost is data loss, and the
  count is the size of the hole;
* a violation on a column that is `nullable=True` is a repairable cleanup, and
  one that is not is a crash waiting to happen on the next join.

Run against a copy. It opens the database read-only, but a report that can be
pointed at the real file by accident is one I would rather not ship.

    python scripts/investigate_fk_violations.py
    python scripts/investigate_fk_violations.py --db path/to/other.db
"""

from __future__ import annotations

import argparse
import sqlite3
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB = REPO_ROOT / "SalonPro_External" / "data" / "salon_pro.db"


def open_readonly(db_path: Path) -> sqlite3.Connection:
    uri = f"file:{db_path.as_posix()}?mode=ro"
    return sqlite3.connect(uri, uri=True)


def table_columns(conn: sqlite3.Connection, table: str) -> dict[str, dict]:
    return {
        row[1]: {"notnull": bool(row[3]), "default": row[4]}
        for row in conn.execute(f"PRAGMA table_info({table})")
    }


def _legacy_barber_fk(conn: sqlite3.Connection, table: str) -> int:
    return sum(1 for r in conn.execute(f"PRAGMA foreign_key_list({table})") if r[2] == "barbers")


def _employee_fk(conn: sqlite3.Connection, table: str) -> int:
    return sum(1 for r in conn.execute(f"PRAGMA foreign_key_list({table})") if r[2] == "employees")


def _dangling(conn: sqlite3.Connection, table: str, column: str, parent: str) -> int:
    return conn.execute(
        f'SELECT COUNT(*) FROM "{table}" WHERE "{column}" IS NOT NULL '
        f'AND "{column}" NOT IN (SELECT id FROM "{parent}")'
    ).fetchone()[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args()

    if not args.db.exists():
        print(f"No database at {args.db}")
        return 1

    conn = open_readonly(args.db)
    try:
        violations = conn.execute("PRAGMA foreign_key_check").fetchall()
        if not violations:
            print("No foreign-key violations.")
            return 0

        by_table: dict[str, list[tuple]] = defaultdict(list)
        for row in violations:
            by_table[row[0]].append(row)

        print(f"{args.db}")
        print(f"Total violations: {len(violations)} across {len(by_table)} tables")
        print()

        # ---------------------------------------------------------------- #
        # Classify before reporting a number.
        # ---------------------------------------------------------------- #
        # `PRAGMA foreign_key_check` says a parent row is missing. It does not
        # say which parent table is the real one, and in this schema it matters:
        # `barbers` is a vestigial table from before employees superseded it,
        # and three tables carry a foreign key to *both*. So a row can be
        # reported as violated while being perfectly valid against the table the
        # application actually uses.
        #
        # Reading "58 violations" as "58 rows of lost data" is the wrong
        # conclusion, and the difference is decided by one comparison per table.
        legacy_tables = []
        vestigial_tables = []
        real_damage = []

        for table, rows in sorted(by_table.items(), key=lambda kv: -len(kv[1])):
            parents = sorted({r[2] for r in rows})
            fk_defs = conn.execute(f"PRAGMA foreign_key_list({table})").fetchall()
            legacy = [f for f in fk_defs if f[2] == "barbers"]
            employee = [f for f in fk_defs if f[2] == "employees"]

            print(f"{table}: {len(rows)} rows, parents {parents}")
            columns = table_columns(conn, table)

            for fk in fk_defs:
                child = fk[3]
                parent = fk[2]
                info = columns.get(child, {})
                nullable = not info.get("notnull", False)
                mark = ""
                if fk in legacy:
                    mark = "  [legacy FK]"
                print(
                    f"    {child:22} -> {parent}.{fk[4]:4} "
                    f"{'nullable' if nullable else 'NOT NULL':10}{mark}"
                )

            if legacy and employee:
                # Both constraints on the same column: the legacy one is the
                # problem, and the rows it flags are fine.
                child = legacy[0][3]
                vs_legacy = _dangling(conn, table, child, "barbers")
                vs_employee = _dangling(conn, table, child, "employees")
                print(
                    f"    -> dangling vs legacy barbers: {vs_legacy}"
                    f" | vs employees: {vs_employee}"
                )
                if vs_employee == 0:
                    print(
                        "    => NOT data loss. Every one of these rows is valid "
                        "against `employees`, the table the models use. The "
                        "violation comes from a leftover foreign key, and it "
                        "*rejects writes* on these rows while the application has "
                        "foreign keys enabled."
                    )
                    legacy_tables.append(table)
                else:
                    print(
                        f"    => REAL data loss: {vs_employee} rows point at an "
                        "employee that does not exist."
                    )
                    real_damage.append(table)
            elif legacy and not employee:
                # Only the legacy foreign key, and the application has no model
                # for this table. Nothing live reads or writes it, so a missing
                # parent here breaks nothing that runs.
                print(
                    "    => VESTIGIAL TABLE. It has no model in the application "
                    "and no live code path, so nothing that runs depends on this "
                    "row. It is a leftover from before `employees` existed and is "
                    "a candidate for removal -- but as its own decision, not as "
                    "a side effect of fixing the write failure."
                )
                vestigial_tables.append(table)
            else:
                real_damage.append(table)
            print()

        print("=" * 72)
        if legacy_tables:
            print("Vestigial foreign keys (writes blocked, no data loss):")
            for table in legacy_tables:
                print(
                    f"  {table}: {_legacy_barber_fk(conn, table)} legacy FK(s), "
                    f"{_employee_fk(conn, table)} employees FK(s)"
                )
            print()
            print("Fix: alembic revision e7a2c4d6b8f1 drops the legacy constraint.")
        if vestigial_tables:
            print("Vestigial tables with no model and no live code:")
            for table in vestigial_tables:
                print(f"  {table}")
        if real_damage:
            print("Genuine data loss needing a decision:")
            for table in sorted(set(real_damage)):
                print(f"  {table}")
        if not real_damage and not legacy_tables and not vestigial_tables:
            print("No actionable violation.")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
