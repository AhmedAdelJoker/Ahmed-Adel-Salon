import os

# Per-process test database: parallel pytest runs (or stale processes) must
# never share one sqlite file — sharing caused cross-run UNIQUE collisions
# and ObjectDeletedError when one process wiped another's rows mid-test.
_PID = os.getpid()
_TEST_DB_FILE = f"test_{_PID}.db"
_TEST_DB_URL = f"sqlite:///./{_TEST_DB_FILE}"

os.environ["DATABASE_URL"] = _TEST_DB_URL
os.environ["TESTING"] = "true"
os.environ["ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["FIRST_SUPERUSER"] = "admin"
os.environ["FIRST_SUPERUSER_PASSWORD"] = "TestAdmin123"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base_class import Base
from app.db.session import get_db

TEST_DATABASE_URL = _TEST_DB_URL

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def pytest_report_header(config):
    """Say which commit, which interpreter and which clocks this run used.

    A pytest failure tail carries no provenance. It says a test failed; it does
    not say which commit's code failed, on which Python, in which timezone. That
    was not a hypothetical problem here -- a stale CI log for
    `test_daily_summary` was read three times as a current failure, because the
    assertion it quoted (`date.today()`) had already been replaced on the branch
    and nothing in the output said so.

    So every run states its own identity, and the two clocks that this codebase
    genuinely has two of:

        commit / branch    which code
        python             which interpreter
        TZ / local now     the machine's clock
        salon timezone     Africa/Cairo by default
        salon today        the app's notion of the current day

    The last two are the ones that matter: a suite that passes at UTC+3 and fails
    at UTC looks exactly like a genuine regression unless the run says which
    clock it used, and the difference between "the application is wrong" and "the
    test wrote its fixtures in the wrong timezone" is decided by one line.
    """
    import os
    import platform
    import subprocess
    import sys
    from datetime import datetime

    def git(*args: str) -> str:
        try:
            out = subprocess.run(
                ["git", *args],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.dirname(os.path.abspath(__file__)),
            )
            return out.stdout.strip() or "-"
        except Exception:  # noqa: BLE001 - provenance is best-effort
            return "-"

    lines = [
        f"commit:      {git('rev-parse', '--short', 'HEAD')}",
        f"branch:      {git('rev-parse', '--abbrev-ref', 'HEAD')}",
        f"python:      {platform.python_version()} ({sys.executable})",
        f"platform:    {platform.system()} {platform.release()}",
        f"TZ env:      {os.environ.get('TZ', '(unset)')}",
        f"local now:   {datetime.now().isoformat(timespec='seconds')}",
    ]

    try:
        from app.core.clock import salon_now
        from app.core.config import settings

        lines += [
            f"salon tz:    {getattr(settings, 'SALON_TIMEZONE', '?')}",
            f"salon now:   {salon_now().isoformat(timespec='seconds')}",
            f"salon today: {salon_now().date()}",
        ]
    except Exception as exc:  # noqa: BLE001
        lines.append(f"salon clock: unavailable ({type(exc).__name__})")

    return lines


def _reset_singletons():
    """Clear limiter and lockout state between tests.

    The state moved out of the two endpoint modules and into `app.core.limiter`,
    which owns both the Redis path and the bounded in-process fallback. Tests
    run with Redis unconfigured, so dropping the fallback is enough — and
    forcing a backend re-probe means a test that sets REDIS_URL can take effect
    on the next call.
    """
    from app.core import limiter
    from app.core.account_lockout import reset_instance

    limiter.reset_memory()
    limiter.reset_backend_cache()
    reset_instance()


def _remove_db_files():
    for suffix in ("", "-wal", "-shm"):
        try:
            os.remove(_TEST_DB_FILE + suffix)
        except FileNotFoundError:
            pass
        except PermissionError:
            pass


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    _reset_singletons()
    if not getattr(setup_database, "_schema_ready", False):
        # Own file per process, but start deterministic anyway: a previous
        # killed run may have left this pid's file behind (pid reuse).
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        setup_database._schema_ready = True
    else:
        # Per-test isolation WITHOUT per-test DDL: wipe rows, keep schema.
        # (Dropping tables per test was slow; skipping cleanup breaks tests
        # via UNIQUE collisions on fixed helper usernames.)
        with engine.begin() as conn:
            conn.execute(text("PRAGMA foreign_keys=OFF"))
            for table in reversed(Base.metadata.sorted_tables):
                conn.execute(text(f'DELETE FROM "{table.name}"'))
            try:
                conn.execute(text("DELETE FROM sqlite_sequence"))
            except Exception:
                pass
            conn.execute(text("PRAGMA foreign_keys=ON"))
    yield
    _reset_singletons()


def pytest_sessionfinish(session, exitstatus):
    """Drop the test schema and remove this process' db files."""
    try:
        with engine.begin() as conn:
            conn.execute(text("PRAGMA foreign_keys=OFF"))
            for table in reversed(Base.metadata.sorted_tables):
                conn.execute(text(f'DROP TABLE IF EXISTS "{table.name}"'))
            conn.execute(text("PRAGMA foreign_keys=ON"))
    finally:
        engine.dispose()
        _remove_db_files()


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)
