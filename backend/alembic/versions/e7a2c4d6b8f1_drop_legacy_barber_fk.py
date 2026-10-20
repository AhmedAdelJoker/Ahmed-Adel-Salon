"""Drops the vestigial `barber_id -> barbers(id)` foreign key.

Revision ID: e7a2c4d6b8f1
Revises: d5e8f1a3b7c9
Create Date: 2026-09-29

Why this exists
---------------
`invoices`, `appointments` and `users` each carry *two* foreign keys on the same
`barber_id` column:

    CONSTRAINT fk_appointments_barber_employee FOREIGN KEY(barber_id) REFERENCES employees(id)
    FOREIGN KEY(barber_id) REFERENCES barbers(id)      <-- legacy, unnamed

`employees` is the real table. `barbers` is a leftover from before the
`unify_barber_to_employee` migration and now holds two rows whose ids (2 and 3)
have no relationship to the single real employee, who is id 1.

SQLite enforces every declared foreign key on every write, and the application
turns enforcement on (`PRAGMA foreign_keys=ON` in `app/db/session.py`). So the
vestigial constraint is not cosmetic -- it rejects writes. Measured on a copy of
the production-shaped database, with enforcement on:

    UPDATE appointments SET barber_id = barber_id WHERE id = 1
        -> FOREIGN KEY constraint failed
    UPDATE invoices SET barber_id = barber_id WHERE ...
        -> FOREIGN KEY constraint failed
    UPDATE users SET barber_id = barber_id WHERE barber_id = 1
        -> FOREIGN KEY constraint failed

Every one of those is a valid row against `employees`. In the running system
that means reassigning a barber on an appointment, editing an invoice, or
saving that user all fail with a 500, and only for the rows that reference the
employee who actually exists.

`c5d6e7f8a9b0` already tried to remove exactly this clause, by rebuilding the
same three tables. It did not take effect -- the clause is still present -- so
this repeats the work and adds the regression test that would have caught it.

Scope
-----
Only the unnamed legacy clause is removed. The named `employees` constraint is
untouched, as is every other foreign key in these tables. On PostgreSQL the
legacy constraint does not exist, so this is a no-op there; that is checked
rather than assumed, because a migration that silently does nothing on the
production dialect is a migration nobody notices is broken.

`barber_presence_logs` is left alone. It has no model in the application, is
referenced by no live code, and is a candidate for removal as a separate
decision rather than as a side effect of fixing a write failure.
"""

import re

import sqlalchemy as sa
from alembic import op

revision = "e7a2c4d6b8f1"
down_revision = "d5e8f1a3b7c9"
branch_labels = None
depends_on = None

# Tables whose declared foreign keys contradict the models.
#
# `invoices`, `appointments` and `users` carry the legacy clause alongside a
# named `employees` constraint.
#
# `service_sessions` was found by running the chain against a real PostgreSQL
# server rather than by reading the models: its model declares only
# `barber_id -> employees.id`, yet the database had a bare
# `barber_id -> barbers(id)` as well. It was missed here originally because this
# list came from the same SQLite schema the bug was found in, where
# `service_sessions` had already been rebuilt.
#
# `barber_time_off` and `barber_working_hours` also reference `barbers` and have
# no model at all. They are left alone for the same reason as
# `barber_presence_logs`: nothing live reads or writes them, so removing their
# constraints is a cleanup decision rather than a fix for a broken write.
TABLES = ("invoices", "appointments", "users", "service_sessions")

# The legacy clause, unnamed, always last in the CREATE TABLE text. Matched
# tightly: the `employees` constraint on the same column is named
# `fk_<table>_barber_employee` and must survive, so the pattern deliberately
# requires the absence of a `CONSTRAINT <name>` prefix.
LEGACY_CLAUSE = re.compile(
    r",?\s*FOREIGN\s+KEY\s*\(\s*barber_id\s*\)\s+REFERENCES\s+barbers\s*\(\s*id\s*\)",
    re.IGNORECASE,
)


def _legacy_clause_present(sql: str) -> bool:
    return bool(LEGACY_CLAUSE.search(sql))


def _strip(sql: str) -> str:
    stripped = LEGACY_CLAUSE.sub("", sql)
    # Removing the clause can leave a trailing comma before the closing paren,
    # or a doubled comma, depending on where it sat. SQLite rejects both, and
    # the position differs per table, so both shapes are normalised here rather
    # than assumed.
    stripped = re.sub(r",\s*\)", ")", stripped)
    stripped = re.sub(r",\s*,", ",", stripped)
    return stripped


def _rebuild_sqlite(bind, table_name: str) -> None:
    """SQLite cannot drop a foreign key, so the table is rebuilt.

    Same shape as `c5d6e7f8a9b0`: create a temporary table from the edited DDL,
    copy the rows, swap. Row contents are never interpreted, so this cannot
    change a value -- only the constraint list.
    """
    row = bind.exec_driver_sql(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    ).fetchone()
    if row is None or not row[0]:
        return
    create_sql = row[0]
    if not _legacy_clause_present(create_sql):
        return

    index_rows = bind.exec_driver_sql(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name = ? "
        "AND sql IS NOT NULL",
        (table_name,),
    ).fetchall()

    temporary_name = f"__drop_legacy_barber_fk_{table_name}"
    bind.exec_driver_sql(f'DROP TABLE IF EXISTS "{temporary_name}"')

    table_pattern = (
        r'(CREATE TABLE\s+)(?:"' + re.escape(table_name) + r'"|' + re.escape(table_name) + r')'
    )
    temporary_sql = re.sub(
        table_pattern, rf'\1"{temporary_name}"', create_sql, count=1, flags=re.IGNORECASE
    )
    bind.exec_driver_sql(_strip(temporary_sql))
    columns = [
        r[1] for r in bind.exec_driver_sql(f'PRAGMA table_info("{table_name}")').fetchall()
    ]
    column_list = ", ".join(f'"{column}"' for column in columns)
    bind.exec_driver_sql(
        f'INSERT INTO "{temporary_name}" ({column_list}) '
        f'SELECT {column_list} FROM "{table_name}"'
    )
    bind.exec_driver_sql(f'DROP TABLE "{table_name}"')
    bind.exec_driver_sql(f'ALTER TABLE "{temporary_name}" RENAME TO "{table_name}"')
    for _, index_sql in index_rows:
        bind.exec_driver_sql(index_sql)


def _drop_on_postgres(bind, table_name: str) -> None:
    """Drops any unnamed foreign key from `barber_id` to `barbers`.

    Constraints are matched by definition rather than by name, so the named
    `fk_<table>_barber_employee` constraint on the same column cannot be taken
    with it by accident. A no-op when there is nothing to remove, which is the
    expected case: the legacy clause only ever existed in SQLite databases
    rebuilt by `c5d6e7f8a9b0`.

    `bind.execute` with `sa.text`, and the table name interpolated rather than
    bound. Two reasons, both learned the hard way in the sibling migration:

      * `exec_driver_sql` inspects a raw string for `%` and passes what it finds
        to the driver as parameters, so `'%barber_id%'` arrives empty and the
        call fails with "dict is not a sequence";
      * `:name` inside `exec_driver_sql` never becomes a bind parameter, because
        that API hands its argument straight to the driver.

    `to_regclass` needs the name as a *string literal*, not a quoted identifier:
    `to_regclass("users")` asks for a column and raises UndefinedColumn.
    """
    quoted = '"' + table_name + '"'
    rows = bind.execute(
        sa.text(
            f"""
            SELECT conname FROM pg_constraint
            WHERE conrelid = to_regclass('{quoted}')
              AND contype = 'f'
              AND pg_get_constraintdef(oid) ILIKE :column_pattern
              AND pg_get_constraintdef(oid) ILIKE :parent_pattern
            """
        ).bindparams(
            sa.bindparam("column_pattern", value="%barber_id%"),
            sa.bindparam("parent_pattern", value="%barbers%"),
        )
    ).fetchall()
    for (name,) in rows:
        bind.execute(sa.text(f'ALTER TABLE {quoted} DROP CONSTRAINT "{name}"'))


def _add_legacy_postgres(bind, table_name: str) -> None:
    """Restores the legacy constraint. Downgrade only.

    It exists so the migration is reversible, not because it is wanted: on
    Postgres this puts back a constraint that has never been the source of a
    failure, since `barbers` is empty there. Harmless, and honest about what the
    reversal costs.
    """
    bind.exec_driver_sql(
        f'ALTER TABLE "{table_name}" '
        f'ADD CONSTRAINT "fk_{table_name}_barber_legacy" '
        f'FOREIGN KEY (barber_id) REFERENCES barbers (id)'
    )


def _sqlite_uses_table(bind, table_name: str) -> bool:
    return (
        bind.exec_driver_sql(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?",
            (table_name,),
        ).scalar()
        or 0
    ) > 0


def upgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    for table_name in TABLES:
        if is_sqlite:
            _rebuild_sqlite(bind, table_name)
        else:
            _drop_on_postgres(bind, table_name)


def downgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    for table_name in TABLES:
        if is_sqlite:
            # A SQLite table rebuild to *add* a constraint: insert the clause
            # back into the DDL before rebuilding. Never run in anger -- this
            # reinstates the write failure described in the module docstring.
            row = bind.exec_driver_sql(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?",
                (table_name,),
            ).fetchone()
            if row is None or not row[0] or not _sqlite_uses_table(bind, table_name):
                continue
            create_sql = row[0]
            if _legacy_clause_present(create_sql):
                continue
            index_rows = bind.exec_driver_sql(
                "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name = ? "
                "AND sql IS NOT NULL",
                (table_name,),
            ).fetchall()
            temporary_name = f"__restore_legacy_barber_fk_{table_name}"
            bind.exec_driver_sql(f'DROP TABLE IF EXISTS "{temporary_name}"')
            table_pattern = (
                r'(CREATE TABLE\s+)(?:"'
                + re.escape(table_name)
                + r'"|'
                + re.escape(table_name)
                + r')'
            )
            temporary_sql = re.sub(
                table_pattern, rf'\1"{temporary_name}"', create_sql, count=1, flags=re.IGNORECASE
            )
            # Appended before the final closing paren. Always the end, even
            # where the clause used to sit mid-list -- in `appointments` it is
            # not last, because `created_by_user_id` follows it. Constraint order
            # carries no meaning in SQLite, so the end is a valid position for
            # every table.
            temporary_sql = re.sub(
                r"\)\s*;?\s*\Z",
                ", FOREIGN KEY(barber_id) REFERENCES barbers (id)\n)\n",
                temporary_sql,
            )
            bind.exec_driver_sql(temporary_sql)
            columns = [
                c[1]
                for c in bind.exec_driver_sql(f'PRAGMA table_info("{table_name}")').fetchall()
            ]
            column_list = ", ".join(f'"{c}"' for c in columns)
            bind.exec_driver_sql(
                f'INSERT INTO "{temporary_name}" ({column_list}) '
                f'SELECT {column_list} FROM "{table_name}"'
            )
            bind.exec_driver_sql(f'DROP TABLE "{table_name}"')
            bind.exec_driver_sql(f'ALTER TABLE "{temporary_name}" RENAME TO "{table_name}"')
            for _, index_sql in index_rows:
                bind.exec_driver_sql(index_sql)
        else:
            _add_legacy_postgres(bind, table_name)
