"""Verifies that a clean-room migration actually produces the mapped schema.

Run it against an empty database, after migrating:

    rm -f salon_pro.db
    alembic upgrade head
    python scripts/verify_migration_head.py

What it proves, and what it cannot
----------------------------------
`alembic upgrade head` exiting 0 means every ``upgrade()`` ran without raising.
It does not mean the resulting schema is the one the application maps. A
migration that creates a table under a name the ORM does not use, forgets a
column that was added to a model afterwards, or omits a table entirely all
produce a green ``alembic upgrade head`` and a 500 on the first request that
touches the table. Neither of the other two schema checks can see this class of
defect: ``verify_postgres_schema.py`` and the Postgres replay in the security job
both build their reference schema *from the models*, so a table that is missing
from the migration history and missing from the models is missing from both
sides of their comparison.

The two directions are checked, and they fail differently on purpose:

* Model -> database is a hard gate. Every table and every column in
  ``Base.metadata`` must exist in the migrated schema.

* Database -> model is printed, not failed. The chain deliberately retains
  tables that no model owns: ``barbers`` and the ``barber_*`` tables are
  documented leftovers in ``e7a2c4d6b8f1``, which explicitly declines to remove
  them as a side effect of an unrelated fix, and
  ``invoice_items_legacy_product_refs`` holds product references rescued from a
  rebuilt table in ``c5d6e7f8a9b0``. Those are cleanup decisions, not migration
  defects, so failing on them would make this gate unfixable short of deleting
  data. They are reported so that a *new* orphan table shows up in the log
  instead of being silently tolerated by the same allow-everything behaviour.

Two details that decide whether this gate means anything:

* The head revision comes from Alembic's own script directory, and the database
  URL is resolved with the same precedence ``alembic/env.py`` uses. Checking a
  hardcoded ``salon_pro.db`` against a hardcoded revision is a gate that passes
  on a database nobody migrated and fails on a migration nobody wrote.

* Settings are deliberately not imported. ``app.core.config`` validates
  ``DATABASE_URL``, ``SECRET_KEY`` and ``FIRST_SUPERUSER_PASSWORD`` at import
  time, so importing the application makes this gate need three secrets in order
  to compare two sets of table names. That is how the check it replaces died:
  ``import app.main`` raised a pydantic ValidationError and CI reported a schema
  failure that had nothing to do with the schema. ``app.db.base`` is sufficient
  and sufficient-only here -- it is the module Alembic's own ``target_metadata``
  is built from, so it is exactly the set of tables the ORM expects, and a model
  absent from it is a defect worth reporting rather than papering over with an
  import that happens to drag it in.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from alembic.config import Config  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402
from sqlalchemy import create_engine, inspect, text  # noqa: E402

import app.db.base  # noqa: F401,E402  registering the models is the point
from app.db.base_class import Base  # noqa: E402

# Alembic's own bookkeeping, owned by no model.
NON_MODEL_TABLES = {"alembic_version"}


def _alembic_config() -> Config:
    """The project's alembic.ini, with its relative paths made absolute.

    ``script_location = alembic`` and ``prepend_sys_path = .`` are resolved
    against the working directory, so run from anywhere but ``backend/`` this
    script would find zero revisions and report a head of ``None``.
    """
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("prepend_sys_path", str(BACKEND_DIR))
    return config


def _database_url(config: Config) -> str:
    """The URL Alembic migrated, in Alembic's own order of precedence.

    Kept in step with ``_database_url()`` in ``alembic/env.py``: process
    environment, then the application settings, then ``sqlalchemy.url`` from
    alembic.ini. The middle step is the one that bites. A developer with
    ``DATABASE_URL`` in ``backend/.env`` migrates *that* database, so a gate
    reading the ini instead would report a failure against a file that was
    never migrated.
    """
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    try:
        from app.core.config import settings

        url = getattr(settings, "DATABASE_URL", None)
        if url:
            return url
    except Exception:
        # Tolerated for the reason alembic/env.py tolerates it: settings can
        # fail validation before any secret is configured, and a migration must
        # still run against the ini default.
        pass
    return config.get_main_option("sqlalchemy.url")


def _describe(url: str) -> str:
    """A human-readable target, so the log names the file that was checked.

    A relative ``sqlite:///./salon_pro.db`` resolves against the working
    directory, and this script may be run from either the repository root or
    ``backend/``. Without this, two runs would differ silently while printing
    the same URL.
    """
    if not url.startswith("sqlite") or "://" not in url:
        return url
    # In `sqlite:///x` the third slash is the empty-authority marker, not part
    # of the path, so exactly one leading slash is removed: `./x` stays
    # relative, `/abs/x` stays absolute, and `C:/x` keeps its drive letter.
    path = url.split("://", 1)[1]
    if path.startswith("/"):
        path = path[1:]
    if not path or path == ":memory:":
        return url
    return f"{url} -> {os.path.abspath(path)}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify a clean-room migration against the models.")
    parser.add_argument(
        "--database-url",
        default=None,
        help="Override the database to inspect. Defaults to the URL Alembic would migrate.",
    )
    args = parser.parse_args()

    config = _alembic_config()
    head = ScriptDirectory.from_config(config).get_current_head()
    url = args.database_url or _database_url(config)

    print(f"database: {_describe(url)}")
    print(f"head:     {head}")

    engine = create_engine(url)
    inspector = inspect(engine)

    if not inspector.has_table("alembic_version"):
        print(
            f"\nno alembic_version table in {_describe(url)}.\n"
            "That database has not been migrated. Run `alembic upgrade head` against the "
            "same URL, or pass --database-url to point at the one that was.",
            file=sys.stderr,
        )
        return 2

    failures: list[str] = []

    # 1. The chain ran to completion. Compared against the script directory
    #    rather than `alembic current`, which would report the same number for
    #    "migrated" and "not migrated".
    with engine.connect() as conn:
        stamped = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    if stamped != head:
        failures.append(f"stamped revision {stamped!r} is not the head {head!r}")

    # 2. No dangling foreign keys. SQLite checks enforcement only at commit
    #    time, so a migration can build a schema whose constraints nothing can
    #    satisfy and every test still passes.
    if engine.dialect.name == "sqlite":
        with engine.connect() as conn:
            violations = conn.execute(text("PRAGMA foreign_key_check")).fetchall()
        if violations:
            failures.append(f"{len(violations)} foreign key violation(s), first: {violations[:3]}")

    # 3. Model -> database.
    db_tables = set(inspector.get_table_names())
    model_tables = set(Base.metadata.tables)

    for name in sorted(model_tables - db_tables):
        failures.append(f"model table not created by the migration chain: {name}")

    for table in Base.metadata.sorted_tables:
        if table.name not in db_tables:
            continue
        have = {c["name"] for c in inspector.get_columns(table.name)}
        absent = sorted({c.name for c in table.columns} - have)
        if absent:
            failures.append(f"{table.name} missing column(s): {absent}")

    # 4. Database -> model. Reported, not failed; see the module docstring.
    unowned = sorted(db_tables - model_tables - NON_MODEL_TABLES)
    if unowned:
        print(
            "\nno model owns these tables (retained deliberately, or awaiting a "
            "cleanup migration):"
        )
        for name in unowned:
            print(f"  - {name}")


    if failures:
        print(f"\n{len(failures)} check(s) failed:")
        for failure in failures:
            print(f"  FAIL {failure}")
        return 1

    print(
        f"\nclean-room migration OK: {head} produced {len(model_tables)} modelled "
        f"table(s), all present with every mapped column"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
