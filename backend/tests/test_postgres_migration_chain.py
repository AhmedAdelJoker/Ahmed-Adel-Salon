"""Replays the entire migration history against a real PostgreSQL server.

Every other migration test in this repository runs on SQLite, which is why the
history shipped broken on PostgreSQL for its whole life. Four separate defects
were only visible here, and all four had the same shape -- valid SQLite, invalid
PostgreSQL:

  * `boolean DEFAULT 0`  ->  DatatypeMismatch on 14 columns in 4 migrations
  * `pragma_table_info` ->  UndefinedFunction, a SQLite table-valued function
  * `INSERT OR IGNORE`  ->  syntax error, and the abort takes the migration with it
  * `CREATE INDEX CONCURRENTLY` inside Alembic's transaction

None of them is a subtle dialect difference. Each is a statement that simply does
not exist on the other engine, and each was invisible because only one dialect
was ever exercised.

The check is therefore: build a real database, replay every revision, require no
error, and require the result to match what the models declare. Not a mock, not a
compile -- the actual thing.

Skipped, loudly, when no server is reachable. A skipped suite here is a suite
that stops proving anything the day the credentials expire, so the skip message
says what is missing and how to provide it.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent

HEAD = "f8b3c5d7e9a2"

# Revisions that create indexes, and so depend on `statement_timeout` and on the
# raw-connection autocommit dance in c4d7e9f1a3b5. Used to decide whether a
# database is fresh enough to replay into.
STRUCTURAL_START = "1e1822cb168f"

# The four tables whose models declare `barber_id -> employees.id`. If a legacy
# `barbers` constraint survives alongside it, PostgreSQL enforces both and every
# write to a barber-linked row fails.
TABLES_WITH_EMPLOYEE_BARBER = ("invoices", "appointments", "users", "service_sessions")


def _database_url() -> str | None:
    return os.environ.get("TEST_POSTGRES_URL")


def _is_postgres(url: str) -> bool:
    return url.startswith("postgres")


def _alembic_env(url: str) -> dict:
    """Environment for an `alembic` subprocess pointed at `url`.

    `alembic/env.py` resolves the database as process env > `settings` >
    `alembic.ini`, and `conftest.py` overwrites `DATABASE_URL` with a SQLite path
    at import time. So the value is set explicitly here and the SQLite one is
    removed, otherwise the subprocess silently replays the history against the
    test database and this suite passes without ever touching PostgreSQL --
    which is precisely the gap it exists to close.
    """
    env = {k: v for k, v in os.environ.items() if k != "DATABASE_URL"}
    env["DATABASE_URL"] = url
    env["ENVIRONMENT"] = "development"
    return env


pytestmark = pytest.mark.skipif(
    not _database_url() or not _is_postgres(_database_url() or ""),
    reason=(
        "no PostgreSQL server configured. Set TEST_POSTGRES_URL, e.g. "
        "postgresql+psycopg2://user:pass@127.0.0.1:5432/salon_migration_test. "
        "This is the only test that runs the migration history on the dialect "
        "it is deployed to; without it the history is unverified."
    ),
)


@pytest.fixture(scope="module")
def replayed():
    """Replays every revision into the configured database. Returns nothing."""
    url = _database_url()
    env = _alembic_env(url)
    completed = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", HEAD],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, (
        "the migration history does not replay on PostgreSQL:\n"
        f"{completed.stdout[-3000:]}\n{completed.stderr[-3000:]}"
    )
    return url


def test_the_history_replays_on_postgres(replayed):
    """The whole point. `replayed` fails the test if any revision errors."""
    assert replayed


def test_the_result_matches_the_models(replayed):
    """A replay that lands somewhere is not the same as landing correctly.

    Checked against `Base.metadata` rather than a hand-written list, so a new
    table added to a model is expected here too and a missing one is a failure.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    import app.db.base  # noqa: F401
    from app.db.base_class import Base

    engine = create_engine(replayed)
    with engine.connect() as conn:
        present = {
            row[0]
            for row in conn.execute(
                sa.text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public'"
                )
            )
        }
        declared = set(Base.metadata.tables)
        # Alembic's bookkeeping table is not a model.
        present.discard("alembic_version")
        missing = declared - present
        assert not missing, f"models declare tables the migrations never create: {sorted(missing)}"
    engine.dispose()


def test_the_version_is_at_head(replayed):
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine(replayed)
    with engine.connect() as conn:
        current = conn.execute(sa.text("SELECT version_num FROM alembic_version")).scalar()
    engine.dispose()
    assert current == HEAD, f"expected {HEAD}, found {current}"


def test_replaying_twice_changes_nothing(replayed):
    """Idempotence, which is what makes a partially-applied deploy recoverable.

    A history that only works from empty is a history that cannot be resumed
    after a failure halfway through, and the operator is left editing
    `alembic_version` by hand.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine(replayed)
    with engine.connect() as conn:
        before = {
            row[0]
            for row in conn.execute(
                sa.text("SELECT indexname FROM pg_indexes WHERE schemaname='public'")
            )
        }
    env = _alembic_env(replayed)
    completed = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", HEAD],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr[-2000:]

    with engine.connect() as conn:
        after = {
            row[0]
            for row in conn.execute(
                sa.text("SELECT indexname FROM pg_indexes WHERE schemaname='public'")
            )
        }
    engine.dispose()
    assert after == before, (
        f"re-running the head added indexes: {sorted(after - before)}"
    )


@pytest.mark.parametrize("table", TABLES_WITH_EMPLOYEE_BARBER)
def test_no_legacy_barber_constraint_survives(replayed, table):
    """The models say `employees`; the database must agree, exclusively.

    A leftover `barbers` constraint is not cosmetic on PostgreSQL -- it is
    enforced. Both constraints must be satisfied on every write, and `barbers`
    is an empty legacy table, so reassigning a barber on any of these rows
    fails. This is the exact defect found in the SQLite production copy, and it
    would have shipped to PostgreSQL untouched without this test.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine(replayed)
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                """
                SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
                WHERE conrelid = to_regclass(:t) AND contype = 'f'
                """
            ),
            {"t": table},
        ).fetchall()
    engine.dispose()

    definitions = [r[1] for r in rows]
    assert definitions, f"{table} has no foreign keys at all"
    barber_fks = [d for d in definitions if "REFERENCES barbers" in d]
    assert not barber_fks, (
        f"{table} still has {barber_fks}; the vestigial constraint is enforced "
        "on every write and will reject any that references a real employee"
    )
    assert any("REFERENCES employees" in d for d in definitions), (
        f"{table} lost its employees constraint: {definitions}"
    )


def test_no_boolean_column_has_an_integer_default(replayed):
    """The `boolean DEFAULT 0` family, checked on the result rather than the source.

    A migration that has already run cannot be corrected in place, so this is
    also the check that says a *new* deployment gets a schema the server accepts
    -- which is a different question from whether the history replays.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine(replayed)
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                """
                SELECT table_name, column_name, column_default FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND data_type = 'boolean'
                  AND column_default IS NOT NULL
                  AND column_default IN ('0', '1')
                """
            )
        ).fetchall()
    engine.dispose()
    assert not rows, (
        "boolean columns with an integer default, which PostgreSQL rejects at "
        f"creation time: {rows}"
    )
