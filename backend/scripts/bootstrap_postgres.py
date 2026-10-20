"""Bootstraps a PostgreSQL database from the model metadata.

Why this exists rather than `alembic upgrade head`
---------------------------------------------------
The Alembic chain is dialect-bound. Thirty-two migrations contain `PRAGMA`,
`sqlite_master` introspection and `INSERT OR IGNORE`, none of which PostgreSQL
parses — so replaying it against Postgres fails on the first SQLite-only
statement. Rewriting thirty-two verified migrations is high-risk work whose only
benefit is a tidier history, and it would put the working SQLite path at risk
for no functional gain.

So the Postgres schema is built from `Base.metadata.create_all` and stamped at
head. `create_all` is dialect-agnostic — SQLAlchemy emits the right DDL per
dialect — and `scripts/verify_postgres_schema.py` proves that rendering
compiles and is complete before this script is ever pointed at a real server.

The trade-off, stated plainly: from this baseline onward every new migration
must be dialect-agnostic, and a Postgres database cannot be rebuilt by replaying
history. In exchange the existing, verified SQLite chain is untouched.

Usage
-----
    DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/salonpro \\
        python scripts/bootstrap_postgres.py --confirm

Refuses to run without `--confirm`, and refuses if the target already has
tables, so it cannot silently overwrite a populated database.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, inspect, text  # noqa: E402

import app.db.base  # noqa: F401,E402  registers every model
from app.db.base_class import Base  # noqa: E402
from app.db.seed import seed_data  # noqa: E402


def current_revision(engine) -> str | None:
    inspector = inspect(engine)
    if "alembic_version" not in inspector.get_table_names():
        return None
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


def head_revision() -> str:
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    return ScriptDirectory.from_config(config).get_current_head()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required. This creates 49 tables in the target database.",
    )
    parser.add_argument(
        "--seed",
        action="store_true",
        help="Insert the baseline settings and the first superuser.",
    )
    args = parser.parse_args()

    from app.core.config import settings

    url = settings.DATABASE_URL
    if not url.startswith("postgres"):
        print(
            f"DATABASE_URL is {url.split('://')[0]}://, not postgres. "
            f"Set it to a PostgreSQL URL; this script refuses to touch anything else.",
            file=sys.stderr,
        )
        return 2

    if not args.confirm:
        print("Refusing to create a schema without --confirm.", file=sys.stderr)
        print(f"Target: {url.split('@')[-1]}", file=sys.stderr)
        return 2

    engine = create_engine(url, pool_pre_ping=True, future=True)

    existing = inspect(engine).get_table_names()
    if existing:
        print(
            f"Target already has {len(existing)} table(s). Refusing to touch it.\n"
            f"If this is a re-run against a known-good database, "
            f"verify the schema with scripts/verify_postgres_schema.py instead.",
            file=sys.stderr,
        )
        return 2

    head = head_revision()
    print(f"target      : {url.split('@')[-1]}")
    print(f"dialect     : {engine.dialect.name}")
    print(f"tables      : {len(Base.metadata.tables)}")
    print(f"stamping    : {head}")
    print("creating ...")

    Base.metadata.create_all(engine, checkfirst=True)

    # Stamp rather than upgrade: the chain is SQLite-bound, and the schema that
    # was just built already reflects every revision in it.
    from alembic import command
    from alembic.config import Config

    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    command.stamp(config, "head")

    with engine.connect() as conn:
        stamped = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        tables = len(inspect(engine).get_table_names())

    print(f"done        : {tables} tables created, stamped at {stamped}")

    if args.seed:
        print("seeding ...")
        with engine.begin() as conn:
            conn.close()
        from app.db.session import SessionLocal

        db = SessionLocal()
        try:
            seed_data(include_demo_data=False)
        finally:
            db.close()
        print("seeded (no demo data)")

    print(
        "\nNext: every new migration must be dialect-agnostic. "
        "`alembic upgrade head` replays SQLite-only SQL and will not work here."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
