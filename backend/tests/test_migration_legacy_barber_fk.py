"""Drops the vestigial `barber_id -> barbers(id)` foreign key, on a copy.

The regression this guards is not "the constraint is gone" -- it is "writes
succeed". A test that only asserted the FK list would have passed against the
schema that has been live all along, because that schema does have the
`employees` constraint and only the vestigial one alongside it.

So the assertions are behavioural: take a row that references the real employee,
write to it, and require it to commit with `PRAGMA foreign_keys=ON`. That is the
operation that fails today.

Run against a copy. Never against the real file.
"""

import shutil
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
PRODUCTION_COPY = REPO_ROOT / "SalonPro_External" / "data" / "salon_pro.db"

REVISION = "e7a2c4d6b8f1"
PREVIOUS = "d5e8f1a3b7c9"
TABLES = ("invoices", "appointments", "users")


@contextmanager
def _pointed_at(database_url: str):
    """Overrides all three levels `alembic/env.py` consults, in its order.

    Process env beats `settings`, which beats the Config option. Moving only one
    of them means the migration runs against the shared test database instead,
    which fails confusingly and for the wrong reason. Restored afterwards so no
    other test in the session inherits it.
    """
    import os

    from app.core import config as config_module

    previous_env = os.environ.get("DATABASE_URL")
    previous_settings = config_module.settings.DATABASE_URL
    os.environ["DATABASE_URL"] = database_url
    config_module.settings.DATABASE_URL = database_url
    try:
        yield
    finally:
        config_module.settings.DATABASE_URL = previous_settings
        if previous_env is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_env


def _alembic(database_url: str, action: str, revision: str) -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    with _pointed_at(database_url):
        if action == "upgrade":
            command.upgrade(config, revision)
        elif action == "downgrade":
            command.downgrade(config, revision)
        else:
            raise ValueError(action)


def _conn(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _legacy_fk_count(conn: sqlite3.Connection, table: str) -> int:
    return sum(
        1 for row in conn.execute(f"PRAGMA foreign_key_list({table})") if row[2] == "barbers"
    )


def _employee_fk_count(conn: sqlite3.Connection, table: str) -> int:
    return sum(
        1 for row in conn.execute(f"PRAGMA foreign_key_list({table})") if row[2] == "employees"
    )


def _row_count(conn: sqlite3.Connection, table: str) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def _try_write(conn: sqlite3.Connection, sql: str) -> str | None:
    try:
        conn.execute(sql)
        conn.commit()
        return None
    except sqlite3.Error as exc:
        conn.rollback()
        return str(exc)


@pytest.fixture
def legacy_db(tmp_path):
    """A copy carrying the defect, stamped at the previous revision."""
    source = PRODUCTION_COPY if PRODUCTION_COPY.exists() else None
    target = tmp_path / "legacy.db"
    if source is not None:
        shutil.copy2(source, target)
    else:
        raise pytest.skip("production-shaped copy is not available here")

    conn = _conn(target)
    present = _legacy_fk_count(conn, "appointments")
    conn.close()
    if not present:
        pytest.skip("the copy no longer carries the legacy foreign key")

    url = f"sqlite:///{target.as_posix()}"
    with _pointed_at(url):
        from alembic import command

        command.stamp(_config_for(url), PREVIOUS)
    return target


def _config_for(url: str):
    from alembic.config import Config

    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    return config


def test_writes_are_blocked_before_the_fix(legacy_db):
    """Documents the defect rather than assuming it.

    If this stops failing, something upstream changed the schema, and the tests
    that follow would be proving less than they claim. Skipped rather than
    failed in that case, because the production copy being repaired is a good
    outcome -- but it should be a visible one.
    """
    conn = _conn(legacy_db)
    try:
        error = _try_write(
            conn, "UPDATE appointments SET barber_id = barber_id WHERE barber_id IS NOT NULL"
        )
    finally:
        conn.close()
    assert error and "FOREIGN KEY" in error.upper(), (
        "the legacy foreign key is no longer blocking writes; this defect is "
        "already fixed in the copy and the tests below are weaker than they look"
    )


def test_the_migration_removes_only_the_legacy_constraint(legacy_db):
    url = f"sqlite:///{legacy_db.as_posix()}"
    _alembic(url, "upgrade", REVISION)

    conn = _conn(legacy_db)
    try:
        for table in TABLES:
            assert _legacy_fk_count(conn, table) == 0, f"{table} still has the legacy FK"
            assert _employee_fk_count(conn, table) == 1, (
                f"{table} lost its employees FK; the migration removed too much"
            )
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    finally:
        conn.close()


def test_writes_succeed_after_the_fix(legacy_db):
    """The behavioural assertion, and the reason the migration exists."""
    url = f"sqlite:///{legacy_db.as_posix()}"
    _alembic(url, "upgrade", REVISION)

    conn = _conn(legacy_db)
    try:
        for label, sql in (
            (
                "appointments: reassign the barber's own value",
                "UPDATE appointments SET barber_id = barber_id WHERE barber_id IS NOT NULL",
            ),
            (
                "invoices: reassign the barber's own value",
                "UPDATE invoices SET barber_id = barber_id WHERE barber_id IS NOT NULL",
            ),
            (
                "users: reassign the barber's own value",
                "UPDATE users SET barber_id = barber_id WHERE barber_id IS NOT NULL",
            ),
        ):
            error = _try_write(conn, sql)
            assert error is None, f"{label} still fails after the migration: {error}"
    finally:
        conn.close()


def test_no_rows_are_lost_or_altered(legacy_db):
    """A table rebuild must be invisible to the data.

    This migration copies rows with `INSERT ... SELECT`, so a column-count or
    ordering mistake shows up here as data loss rather than as a constraint
    change nobody notices.
    """
    url = f"sqlite:///{legacy_db.as_posix()}"

    before = {}
    conn = _conn(legacy_db)
    try:
        for table in TABLES:
            columns = [c[1] for c in conn.execute(f"PRAGMA table_info({table})").fetchall()]
            before[table] = (columns, _row_count(conn, table), conn.execute(f"SELECT * FROM {table}").fetchall())
    finally:
        conn.close()

    _alembic(url, "upgrade", REVISION)

    conn = _conn(legacy_db)
    try:
        for table in TABLES:
            columns = [c[1] for c in conn.execute(f"PRAGMA table_info({table})").fetchall()]
            rows = conn.execute(f"SELECT * FROM {table}").fetchall()
            expected_columns, expected_count, expected_rows = before[table]
            assert columns == expected_columns, f"{table} columns changed"
            assert len(rows) == expected_count, f"{table} row count changed"
            assert rows == expected_rows, f"{table} contents changed"
    finally:
        conn.close()


def test_it_is_reversible_and_the_reversal_reinstates_the_failure(legacy_db):
    """Both directions are checked, and the downgrade is verified to be harmful.

    A downgrade that silently does nothing would be worse than no downgrade:
    the next person to hit a problem would trust it had rolled back.
    """
    url = f"sqlite:///{legacy_db.as_posix()}"
    _alembic(url, "upgrade", REVISION)

    conn = _conn(legacy_db)
    try:
        assert _legacy_fk_count(conn, "appointments") == 0
    finally:
        conn.close()

    _alembic(url, "downgrade", PREVIOUS)

    conn = _conn(legacy_db)
    try:
        assert _legacy_fk_count(conn, "appointments") == 1, "the downgrade did nothing"
        error = _try_write(
            conn, "UPDATE appointments SET barber_id = barber_id WHERE barber_id IS NOT NULL"
        )
        assert error and "FOREIGN KEY" in error.upper(), (
            "the downgrade restored the constraint but not its effect"
        )
    finally:
        conn.close()

    # And the upgrade runs again cleanly from the reverted state.
    _alembic(url, "upgrade", REVISION)
    conn = _conn(legacy_db)
    try:
        assert _legacy_fk_count(conn, "appointments") == 0
        assert _try_write(
            conn, "UPDATE appointments SET barber_id = barber_id WHERE barber_id IS NOT NULL"
        ) is None
    finally:
        conn.close()
