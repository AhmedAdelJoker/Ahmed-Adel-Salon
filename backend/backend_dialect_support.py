"""Dialect-neutral column introspection for migrations.

`pragma_table_info(...)` is a SQLite *table-valued function*, not a PRAGMA you
can send to any server. PostgreSQL has no equivalent, and the failures are
misleading rather than obvious:

    SELECT type FROM pragma_table_info('users') WHERE name = 'totp_secret'
    -> UndefinedFunction: function pragma_table_info(unknown) does not exist

which reads as a missing table or a typo rather than as "this is SQLite-only
syntax". It appears in four migrations in this repository, and every one of them
had passed on SQLite for the whole life of the project.

Two implementations, one question: does this table have this column, and what
type is it. `information_schema.columns` is the portable answer and is
authoritative on both engines.
"""

from __future__ import annotations

import re
import sqlalchemy as sa

_SAFE_IDENTIFIER = re.compile(r"\A[A-Za-z_][A-Za-z0-9_]{0,62}\Z")

# information_schema is per-database, and this schema keeps everything in
# `public`. Made explicit because the default `search_path` of a connection
# created by a migration is not guaranteed to include it.
_SCHEMA = "public"


def _check(name: str, kind: str) -> str:
    if not isinstance(name, str) or not _SAFE_IDENTIFIER.match(name):
        raise ValueError(f"refusing to build SQL: {kind} {name!r} is not an identifier")
    return name


def column_type(conn, table: str, column: str) -> str | None:
    """The declared SQL type of `table.column`, or None if it does not exist."""
    _check(table, "table name")
    _check(column, "column name")
    if conn.dialect.name == "sqlite":
        rows = conn.execute(
            sa.text(f'PRAGMA table_info("{table}")')
        ).fetchall()
        for row in rows:
            if row[1] == column:
                return str(row[2]).upper()
        return None
    row = conn.execute(
        sa.text(
            """
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table AND column_name = :column
            """
        ),
        {"schema": _SCHEMA, "table": table, "column": column},
    ).fetchone()
    return row[0].upper() if row else None


def has_column(conn, table: str, column: str) -> bool:
    return column_type(conn, table, column) is not None


def columns_of(conn, table: str) -> list[str]:
    """Every column name on `table`, in declaration order where knowable."""
    _check(table, "table name")
    if conn.dialect.name == "sqlite":
        return [r[1] for r in conn.execute(sa.text(f'PRAGMA table_info("{table}")')).fetchall()]
    rows = conn.execute(
        sa.text(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table
            ORDER BY ordinal_position
            """
        ),
        {"schema": _SCHEMA, "table": table},
    ).fetchall()
    return [r[0] for r in rows]


def table_exists(conn, table: str) -> bool:
    _check(table, "table name")
    if conn.dialect.name == "sqlite":
        return bool(
            conn.execute(
                sa.text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:n"),
                {"n": table},
            ).fetchone()
        )
    return bool(
        conn.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = :schema AND table_name = :name"
            ),
            {"schema": _SCHEMA, "name": table},
        ).fetchone()
    )


def index_exists(conn, index: str) -> bool:
    """Whether an index of this name exists anywhere in the schema.

    PostgreSQL names indexes per-schema like tables, so this is the same
    question as `table_exists` with a different catalogue.
    """
    _check(index, "index name")
    if conn.dialect.name == "sqlite":
        return bool(
            conn.execute(
                sa.text("SELECT 1 FROM sqlite_master WHERE type='index' AND name=:n"),
                {"n": index},
            ).fetchone()
        )
    return bool(
        conn.execute(
            sa.text(
                "SELECT 1 FROM pg_indexes WHERE schemaname = :schema AND indexname = :name"
            ),
            {"schema": _SCHEMA, "name": index},
        ).fetchone()
    )
