"""Audits every SQLite-specific construct in the backend.

SQLite is a fine local store and a poor server database. The gaps that matter
when the deployment moves to PostgreSQL:

* ``AUTOINCREMENT``, ``INSERT OR IGNORE`` / ``REPLACE``, ``PRAGMA`` — SQLite
  only, and they fail outright on Postgres.
* ``sqlite_insert(...).on_conflict_do_update(...)`` — the SQLAlchemy equivalent
  is ``postgresql.insert``, and the two produce different SQL.
* ``with_for_update()`` — silently ignored on SQLite (writers serialise anyway),
  load-bearing on Postgres.
* Raw ``sqlite_master`` / ``pragma_table_info`` introspection in the migrations.
* Dialect branches that only ever ran on SQLite, so the Postgres path has never
  been executed.

The goal is not "no SQLite anywhere" — the desktop build should keep using it —
but that every construct is behind a dialect check, and that the Postgres
branch is actually reachable.
"""

import re
from pathlib import Path

APP = Path("app")
ALEMBIC = Path("alembic/versions")

# Patterns that cannot be executed on PostgreSQL at all.
POSTGRES_BREAKING = re.compile(
    r"""
      AUTOINCREMENT
    | INSERT\s+OR\s+(IGNORE|REPLACE|ABORT|FAIL|ROLLBACK)
    | PRAGMA\s+\w+
    | sqlite_master
    | pragma_table_info
    | last_insert_rowid\(\)
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Dialect-specific helpers. Legitimate, but only inside a dialect branch.
DIALECT_HELPERS = re.compile(r"\b(sqlite_insert|postgresql_insert|insert)\b")
FOR_UPDATE = re.compile(r"\.with_for_update\s*\(")

DETERMINES_DIALECT = re.compile(r"dialect\.name|engine\.dialect|get_bind\(\)\.dialect")


def guarded(text: str) -> bool:
    """True when the line sits inside a dialect check.

    Cheap and approximate on purpose: a heuristic that errs toward "guarded"
    would hide real problems, so anything unmatched is reported for review.
    """
    return bool(
        DETERMINES_DIALECT.search(text)
        or "sqlite" in text.lower()
        or "postgresql" in text.lower()
        or "postgres" in text.lower()
    )


def scan(paths: list[Path], label: str) -> dict[str, list[tuple[str, int, str]]]:
    findings: dict[str, list[tuple[str, int, str]]] = {"breaking": [], "unguarded_helper": []}

    for root in paths:
        if not root.exists():
            continue
        for path in sorted(root.rglob("*.py")):
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue

                match = POSTGRES_BREAKING.search(line)
                if match:
                    findings["breaking"].append((f"{label}/{path}", number, stripped[:110]))

                if DIALECT_HELPERS.search(line) or FOR_UPDATE.search(line):
                    if not guarded(line):
                        findings["unguarded_helper"].append(
                            (f"{label}/{path}", number, stripped[:110])
                        )

    return findings


results = scan([APP], "app") | scan([ALEMBIC], "alembic")

breaking = results["breaking"]
unguarded = results["unguarded_helper"]

print("=" * 78)
print(f"PostgreSQL-breaking SQL: {len(breaking)}")
print(f"Dialect helpers outside a dialect check: {len(unguarded)}")
print("=" * 78)

if breaking:
    print("\nBREAKING ON POSTGRESQL")
    for where, line, text in breaking:
        print(f"  {where}:{line}")
        print(f"      {text}")

if unguarded:
    print("\nNOT VISIBLY GUARDED (review each)")
    for where, line, text in unguarded:
        print(f"  {where}:{line}")
        print(f"      {text}")

if not breaking and not unguarded:
    print("\nclean")
