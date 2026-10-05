"""Compiles the whole model schema to PostgreSQL DDL, without a server.

There is no Postgres and no Docker in this environment, so a live migration
cannot be run here. What *can* be verified statically is the thing that actually
blocks the move: whether `Base.metadata` renders valid, complete PostgreSQL
DDL. `create_mock_engine` compiles every statement and throws it away, which
catches the failures that would otherwise only appear on first deploy:

* a column type the dialect has no equivalent for;
* SQLite-only syntax emitted by a custom type or constraint;
* a table or column that only exists because `create_all` was patched by hand;
* a `server_default` that is valid on one dialect and not the other.

The same check is run for SQLite so the two renderings can be compared, and the
PostgreSQL output is scanned for SQLite-only tokens.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# Run as `python scripts/verify_postgres_schema.py` from the backend root, but
# also work when invoked from elsewhere by putting the project root on the path.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_mock_engine  # noqa: E402
from sqlalchemy.dialects import postgresql, sqlite  # noqa: E402
from sqlalchemy.schema import CreateIndex, CreateTable  # noqa: E402

# Importing base registers every model, which is what populates the metadata.
import app.db.base  # noqa: F401,E402
from app.db.base_class import Base  # noqa: E402

# Tokens that cannot appear in PostgreSQL DDL. A match means something in the
# model layer is emitting SQLite-specific syntax.
SQLITE_ONLY_TOKENS = re.compile(
    r"""
      \bAUTOINCREMENT\b
    | \bPRAGMA\b
    | \bINSERT\s+OR\s+\w+
    | sqlite_master
    | \bWITHOUT\s+ROWID\b
    """,
    re.IGNORECASE | re.VERBOSE,
)


def scan_for_sqlite_only(ddl: dict[str, str]) -> list[str]:
    """Finds SQLite-only syntax in the PostgreSQL rendering."""
    offenders = []
    for name, sql in ddl.items():
        for match in SQLITE_ONLY_TOKENS.finditer(sql):
            offenders.append(f"{name}: {match.group(0)!r}")
    return offenders


def render(url: str, label: str) -> tuple[dict[str, str], list[str]]:
    """Compiles every table and index. Returns (ddl_by_name, failures)."""
    ddl: dict[str, str] = {}
    failures: list[str] = []

    def collect(sql, *args, **kwargs):
        ddl[f"{label}:{len(ddl):04d}"] = str(sql)
        return None

    engine = create_mock_engine(url, collect)
    metadata = Base.metadata

    for table in metadata.sorted_tables:
        try:
            collect(CreateTable(table).compile(dialect=engine.dialect))
        except Exception as exc:
            failures.append(f"CREATE TABLE {table.name}: {type(exc).__name__}: {exc}")

    for table in metadata.sorted_tables:
        for index in table.indexes:
            try:
                collect(CreateIndex(index).compile(dialect=engine.dialect))
            except Exception as exc:
                failures.append(f"CREATE INDEX {index.name}: {type(exc).__name__}: {exc}")

    return ddl, failures


def find_fk_cycles() -> list[list[str]]:
    """Tables that reference each other in a cycle with no deferred edge.

    SQLite tolerates a cycle: it defers foreign-key enforcement until the
    statement commits. PostgreSQL does not — `CREATE TABLE` cannot reference a
    table that does not exist yet, so a cycle fails the whole bootstrap.

    An FK declared with ``use_alter=True`` is emitted as a separate
    ``ALTER TABLE ... ADD CONSTRAINT`` after every table exists, which satisfies
    the dependency. Those edges are therefore excluded: a cycle is only a
    blocker when *no* edge in it is deferred.
    """
    graph: dict[str, set[str]] = {t.name: set() for t in Base.metadata.sorted_tables}
    for table in Base.metadata.sorted_tables:
        for fk in table.foreign_keys:
            if fk.use_alter:
                continue  # emitted after all CREATE TABLEs
            target = fk.column.table.name
            if target != table.name:
                graph[table.name].add(target)

    cycles: list[list[str]] = []
    state: dict[str, int] = {}  # 0 unvisited, 1 on stack, 2 done
    stack: list[str] = []

    def visit(node: str) -> None:
        state[node] = 1
        stack.append(node)
        for nxt in sorted(graph.get(node, ())):
            if state.get(nxt, 0) == 1:
                start = stack.index(nxt)
                cycles.append(stack[start:] + [nxt])
            elif state.get(nxt, 0) == 0:
                visit(nxt)
        stack.pop()
        state[node] = 2

    for name in sorted(graph):
        if state.get(name, 0) == 0:
            visit(name)

    # Deduplicate rotations of the same cycle.
    unique: dict[frozenset, list[str]] = {}
    for cycle in cycles:
        unique.setdefault(frozenset(cycle), cycle)
    return list(unique.values())


def main() -> int:
    tables = list(Base.metadata.sorted_tables)
    print(f"mapped tables: {len(tables)}")
    print(f"mapped columns: {sum(len(t.columns) for t in tables)}")
    print(f"mapped indexes: {sum(len(t.indexes) for t in tables)}")

    pg_ddl, pg_failures = render("postgresql://", "pg")
    lite_ddl, lite_failures = render("sqlite://", "lite")

    print(f"\npostgres statements compiled: {len(pg_ddl)}")
    print(f"sqlite   statements compiled: {len(lite_ddl)}")

    problems: list[str] = []

    for failure in pg_failures:
        problems.append(f"postgres compile failure — {failure}")
    for failure in lite_failures:
        problems.append(f"sqlite compile failure — {failure}")

    for offender in scan_for_sqlite_only(pg_ddl):
        problems.append(f"SQLite-only token in postgres DDL — {offender}")

    created = set()
    for sql in pg_ddl.values():
        match = re.match(r"\s*CREATE TABLE\s+(\S+)", sql, re.IGNORECASE)
        if match:
            created.add(match.group(1).strip('"'))

    missing = sorted(t.name for t in tables if t.name not in created)
    if missing:
        problems.append(f"tables with no CREATE TABLE on postgres: {missing}")

    for cycle in find_fk_cycles():
        problems.append("foreign-key cycle rejected by CREATE TABLE on postgres: " + " -> ".join(cycle))

    if problems:
        print(f"\n{len(problems)} problem(s):\n")
        for problem in problems:
            print(f"  {problem}")
        return 1

    print("\nall tables and indexes render on PostgreSQL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
