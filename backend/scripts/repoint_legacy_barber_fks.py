"""Repairs a pre-unification foreign key that points at `barbers`.

SQLite cannot alter a foreign key; the only way to change one is to rebuild the
table. That is what this does, for the single constraint that can be in the
wrong state: `service_sessions.barber_id`, which databases created before
`0de75d6f3a31` point at `barbers` while the model has declared
`ForeignKey("employees.id")` since that migration.

A fresh database never needs this -- `alembic upgrade head` builds the
constraint correctly -- so it is a repair for databases that predate the
unification, not a step in the migration chain. It exists because
`c7e9a1b3d5f2` refuses to drop `barbers` while anything still points at it, and
silently carrying a dangling constraint forward is worse than stopping.

Run it on a copy first. It prints what it will do before it does it, and it
refuses a database where the constraint it expected to find is not the one
present.
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
import sys
from pathlib import Path

LEGACY_PARENT = "barbers"
CORRECT_PARENT = "employees"
#: Only this one. Every other table was rebuilt by the unification migration.
TARGET_TABLE = "service_sessions"
TARGET_COLUMN = "barber_id"


def offenders(conn: sqlite3.Connection) -> list[str]:
    """Tables outside the legacy four that still point at `barbers`."""
    legacy = {"barbers", "barber_presence_logs", "barber_time_off", "barber_working_hours"}
    out = []
    for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        if name in legacy:
            continue
        for row in conn.execute(f"PRAGMA foreign_key_list('{name}')"):
            if row[2] == LEGACY_PARENT:
                out.append(name)
    return sorted(set(out))


def rebuild(conn: sqlite3.Connection, table: str) -> int:
    """Recreate `table` with its `barbers` key replaced by `employees`.

    The whole table is copied, so this works whether or not it holds rows. The
    existing schema is reused rather than restated: `sqlite_master.sql` is
    already a complete `CREATE TABLE` statement, primary key and all, so the
    only edit made to it is the one parent table named in a `REFERENCES` clause.
    Reconstructing the column list from `PRAGMA table_info` would lose exactly
    the things that are hardest to notice afterwards -- a server default, a
    collation, a check constraint, a composite primary key.
    """
    fks = [row for row in conn.execute(f"PRAGMA foreign_key_list('{table}')") if row[2] == LEGACY_PARENT]
    if not fks:
        raise SystemExit(f"{table} has no foreign key to {LEGACY_PARENT}; nothing to rebuild")

    ddl = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    if not ddl or not ddl[0]:
        raise SystemExit(f"{table} has no stored DDL; refusing to guess its shape")
    ddl = ddl[0]

    # SQLite normalises a `REFERENCES` clause to unquoted form on creation, but a
    # database written by another tool can carry either, so both are handled.
    for form in (f'REFERENCES "{LEGACY_PARENT}"', f"REFERENCES {LEGACY_PARENT}"):
        ddl = ddl.replace(form, f'REFERENCES "{CORRECT_PARENT}"')
    if LEGACY_PARENT in ddl:
        raise SystemExit(
            f"could not rewrite the constraint: {LEGACY_PARENT} still appears in the "
            f"stored DDL. Refusing to drop a table on a guess.\n  {ddl}"
        )
    # The rewrite above is a string substitution, and a misspelling in it produces
    # a CREATE TABLE that fails several lines later with a syntax error that names
    # nothing useful. Asserting the parent was actually written is what turns that
    # into an error that says what happened.
    if CORRECT_PARENT not in ddl:
        raise SystemExit(
            f"the rewritten DDL does not mention {CORRECT_PARENT}, so the "
            f"substitution did not do what it claims:\n  {ddl}"
        )

    columns = [r[1] for r in conn.execute(f"PRAGMA table_info('{table}')")]
    if not columns:
        raise SystemExit(f"{table} has no columns; refusing to guess")
    quoted_cols = ", ".join(f'"{c}"' for c in columns)
    rows = list(conn.execute(f'SELECT {quoted_cols} FROM "{table}"'))

    # Take explicit control of the transaction. sqlite3's implicit handling
    # commits before DDL, which would split this rename/create/copy/drop into
    # four transactions and leave a renamed husk behind if the copy failed.
    previous_isolation = conn.isolation_level
    conn.isolation_level = None
    try:
        # Foreign keys off for the swap, or the rebuild trips over the very
        # constraint being corrected. It is a no-op inside a transaction, so it
        # has to happen before BEGIN.
        conn.execute("PRAGMA foreign_keys=OFF")
        conn.execute("BEGIN")
        try:
            conn.execute(f'ALTER TABLE "{table}" RENAME TO "{table}__legacy_fk_rebuild"')
            conn.execute(ddl)
            if rows:
                placeholders = ", ".join("?" for _ in columns)
                conn.executemany(
                    f'INSERT INTO "{table}" ({quoted_cols}) VALUES ({placeholders})', rows
                )
            conn.execute(f'DROP TABLE "{table}__legacy_fk_rebuild"')
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise
    finally:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.isolation_level = previous_isolation
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", default="salon_pro.db")
    parser.add_argument("--yes", action="store_true", help="do not prompt")
    args = parser.parse_args()

    path = Path(args.database)
    if not path.exists():
        print(f"{path} does not exist", file=sys.stderr)
        return 2

    conn = sqlite3.connect(path)
    found = offenders(conn)
    if not found:
        print("nothing to repair: no table outside the legacy four points at `barbers`")
        return 0

    unexpected = [name for name in found if name != TARGET_TABLE]
    if unexpected:
        print(
            f"refusing: {unexpected} also point at `barbers`, and this script only "
            f"knows how to rebuild {TARGET_TABLE}. Repair those by hand.",
            file=sys.stderr,
        )
        return 1

    print(f"database: {path.resolve()}")
    print(f"table:    {TARGET_TABLE}.{TARGET_COLUMN} -> {LEGACY_PARENT} (should be {CORRECT_PARENT})")
    count = conn.execute(f"SELECT COUNT(*) FROM {TARGET_TABLE}").fetchone()[0]
    print(f"rows:     {count} (all copied to the rebuilt table)")

    if not args.yes:
        reply = input("rebuild it? [y/N] ").strip().lower()
        if reply not in ("y", "yes"):
            print("left alone")
            return 0

    backup = path.with_suffix(path.suffix + ".bak_before_fk_repoint")
    shutil.copy2(path, backup)
    print(f"backup:   {backup.name}")

    moved = rebuild(conn, TARGET_TABLE)
    conn.commit()

    remaining = offenders(conn)
    print(f"moved {moved} row(s)")
    if remaining:
        print(f"still referencing `barbers`: {remaining}", file=sys.stderr)
        return 1

    check = conn.execute("PRAGMA foreign_key_check").fetchall()
    print(f"foreign_key_check: {'clean' if not check else check}")
    print("done: `alembic upgrade head` can now drop the legacy tables")
    return 0 if not check else 1


if __name__ == "__main__":
    raise SystemExit(main())
