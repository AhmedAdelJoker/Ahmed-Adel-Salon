"""Migration test for `users.first_login_at` (d5e8f1a3b7c9).

Applied to a copy of the production-shaped database rather than a fresh one,
because the interesting failure mode here is specifically about existing rows:
a migration that invents values for the six users already in the database would
reset their grace period to the moment of the upgrade instead of starting it at
their next real sign-in.

Also checks the downgrade, since a migration nobody can reverse is a migration
nobody can roll back when it turns out to be wrong.
"""

import shutil
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
PRODUCTION_COPY = BACKEND_ROOT.parent / "SalonPro_External" / "data" / "salon_pro.db"

REVISION = "d5e8f1a3b7c9"
PREVIOUS = "c4d7e9f1a3b5"


def _config(database_url: str):
    from alembic.config import Config

    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


@contextmanager
def _pointed_at(database_url: str):
    """Runs alembic against `database_url`, not the session database.

    `alembic/env.py` deliberately ignores the URL on the Config object. Its
    precedence is process env first, then `settings.DATABASE_URL`, then
    `alembic.ini` -- which is correct for a real deployment, where the
    application and the migration must agree on one database.

    That same precedence is why a first version of this test failed with a
    duplicate-column error that had nothing to do with the migration. It set the
    URL on the Config, so every command ran against the shared test database,
    which already had the column from `create_all`. Then it set
    `settings.DATABASE_URL`, which still lost to the environment variable
    `conftest.py` had set. All three levels have to be moved for the override to
    take, and the env var is restored afterwards so nothing else in the session
    is affected.
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

    with _pointed_at(database_url):
        config = _config(database_url)
        if action == "upgrade":
            command.upgrade(config, revision)
        elif action == "downgrade":
            command.downgrade(config, revision)
        else:
            raise ValueError(f"unsupported action {action!r}")


def _stamp(database_url: str, revision: str) -> None:
    from alembic import command

    with _pointed_at(database_url):
        command.stamp(_config(database_url), revision)


def _columns(db_path: Path) -> set[str]:
    conn = sqlite3.connect(db_path)
    try:
        return {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    finally:
        conn.close()


def _user_count(db_path: Path) -> int:
    conn = sqlite3.connect(db_path)
    try:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    finally:
        conn.close()


def test_the_revision_is_reachable_and_the_chain_has_one_head():
    """`d5e8f1a3b7c9` must be an ancestor of the head, and the head must be single.

    Not "is the head" -- a later migration legitimately moves the head along,
    and a test that pinned the head would fail every time one is added. What
    must hold is that this revision is still in the chain (it was not orphaned
    by a rewrite) and that no branch has split.
    """
    from alembic.script import ScriptDirectory

    script = ScriptDirectory.from_config(_config("sqlite:///:memory:"))
    heads = script.get_heads()
    assert len(heads) == 1, f"the migration history has branched: {heads}"

    revision = script.get_revision(REVISION)
    assert revision is not None, f"{REVISION} is missing from the history"
    assert revision.down_revision == PREVIOUS, (
        "the parent of this revision changed, so the chain was rewritten"
    )

    # Walk forward from this revision and confirm the head is reachable.
    # `nextrev` is a frozenset in current Alembic and a plain string in older
    # releases, so both shapes are handled rather than pinned to one version.
    seen = {REVISION}
    cursor = revision
    while cursor.nextrev:
        nxt = cursor.nextrev
        candidates = [nxt] if isinstance(nxt, str) else list(nxt)
        assert len(candidates) == 1, f"{cursor.revision} branches to {candidates}"
        cursor = script.get_revision(candidates[0])
        assert cursor.revision not in seen, f"cycle at {cursor.revision}"
        seen.add(cursor.revision)
    assert heads[0] in seen, (
        f"head {heads[0]} is not reachable from {REVISION}; the history has split"
    )


def _build_like_bootstrap(db_path: Path) -> str:
    """Creates the schema the way this project actually creates it.

    `Base.metadata.create_all` followed by a stamp, which is what
    `scripts/bootstrap_postgres.py` and the development entry point do. Running
    the whole Alembic chain from an empty file is not a supported path here and
    fails on a table that the initial revision and a later one both create --
    the known consequence of the SQLite-specific DDL in the existing history.

    The migration still gets exercised below, because the interesting direction
    is `PREVIOUS stamp -> head`, which is exactly what an existing deployment
    does.
    """
    from sqlalchemy import create_engine

    import app.db.base  # noqa: F401
    from app.db.base_class import Base

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    Base.metadata.create_all(bind=engine)
    engine.dispose()
    return f"sqlite:///{db_path.as_posix()}"


def test_the_column_is_added_and_removed_around_a_stamped_previous(tmp_path):
    db_path = tmp_path / "stamped.db"
    url = _build_like_bootstrap(db_path)

    # Pretend the database was bootstrapped before this migration existed: drop
    # the column to reproduce the old schema, then stamp the previous revision.
    # Doing it this way round means `create_all` does not leave the column
    # behind, which would make the test pass without the migration running.
    conn = sqlite3.connect(db_path)
    conn.execute("ALTER TABLE users DROP COLUMN first_login_at")
    conn.commit()
    conn.close()
    _stamp(url, PREVIOUS)
    assert "first_login_at" not in _columns(db_path)

    _alembic(url, "upgrade", REVISION)
    assert "first_login_at" in _columns(db_path)

    _alembic(url, "downgrade", PREVIOUS)
    assert "first_login_at" not in _columns(db_path)

    # And it comes back, because a downgrade that cannot be re-upgraded means the
    # rollback leaves the schema in a state nobody can deploy from.
    _alembic(url, "upgrade", REVISION)
    assert "first_login_at" in _columns(db_path)


def test_existing_rows_are_left_null(tmp_path):
    """The reason this migration is written the way it is.

    Backfilling `first_login_at` with "now" would make every existing owner a
    first-time login again. Any backfill value is a claim about a login that did
    not happen. Leaving it null lets the login endpoint record the truth, and the
    policy falls back to `created_at` until it does.
    """
    db_path = tmp_path / "populated.db"
    url = _build_like_bootstrap(db_path)

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO users (username, hashed_password, role, is_active, token_version) "
        "VALUES ('existing_owner', 'x', 'owner', 1, 0)"
    )
    conn.execute("ALTER TABLE users DROP COLUMN first_login_at")
    conn.commit()
    conn.close()
    _stamp(url, PREVIOUS)

    _alembic(url, "upgrade", REVISION)

    conn = sqlite3.connect(db_path)
    try:
        value = conn.execute(
            "SELECT first_login_at FROM users WHERE username = 'existing_owner'"
        ).fetchone()[0]
    finally:
        conn.close()
    assert value is None, "the migration fabricated a login timestamp"


def _foreign_key_violations(db_path: Path) -> list[tuple]:
    conn = sqlite3.connect(db_path)
    try:
        return conn.execute("PRAGMA foreign_key_check").fetchall()
    finally:
        conn.close()


def _rewind_first_login_column(db_path: Path) -> bool:
    """Drop `users.first_login_at` from the copy if it is already there.

    This test's value is entirely in running the migration against a database
    that is *before* the revision. It used to assume the live database was
    always unmigrated, so the assertion

        assert "first_login_at" not in _columns(target)

    could only pass on a machine where nobody had ever started the app. Once the
    local database was migrated -- which is the normal state of any working
    checkout -- the precondition failed and the test reported a migration
    problem that did not exist.

    Rewinding the copy makes the test depend on the migration rather than on
    somebody's local state, and it leaves the live database alone: this operates
    on the tmp_path copy, which is the only file in this test that gets modified.

    Returns whether a column was actually dropped, so the caller can assert the
    rewind did something rather than silently passing on a no-op.
    """
    if "first_login_at" not in _columns(db_path):
        return False

    conn = sqlite3.connect(db_path)
    try:
        # Safe here because the migration adds a bare nullable column and creates
        # no index on it; SQLite refuses to drop an indexed column.
        conn.execute("ALTER TABLE users DROP COLUMN first_login_at")
        conn.commit()
    finally:
        conn.close()

    assert "first_login_at" not in _columns(db_path), "the rewind did not take"
    return True


@pytest.mark.skipif(
    not PRODUCTION_COPY.exists(), reason="production-shaped copy is not available here"
)
def test_it_applies_cleanly_to_a_production_shaped_copy(tmp_path):
    """On real data, which is the only test that means anything here.

    A synthetic database with one inserted row proves the SQL is valid. It does
    not prove the migration runs against a schema that has been through every
    previous revision on a database that was never rebuilt from scratch.
    """
    target = tmp_path / "production-copy.db"
    shutil.copy2(PRODUCTION_COPY, target)
    _rewind_first_login_column(target)
    url = f"sqlite:///{target.as_posix()}"

    before_users = _user_count(target)
    violations_before = _foreign_key_violations(target)

    _stamp(url, PREVIOUS)
    assert "first_login_at" not in _columns(target)

    _alembic(url, "upgrade", REVISION)

    assert "first_login_at" in _columns(target)
    assert _user_count(target) == before_users, "the migration lost users"

    # Compared against what was there before, not against zero.
    #
    # The production copy has pre-existing foreign-key violations, and a test
    # asserting `foreign_key_check` is empty would fail for damage that predates
    # this migration by every revision in the history. That is a real finding
    # worth investigating separately, and it is not this migration's. What
    # matters here is whether *this* migration made anything worse.
    assert _foreign_key_violations(target) == violations_before, (
        "the migration changed the foreign-key state of the database"
    )

    conn = sqlite3.connect(target)
    try:
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    finally:
        conn.close()

    _alembic(url, "downgrade", PREVIOUS)
    assert "first_login_at" not in _columns(target)
    assert _user_count(target) == before_users
    assert _foreign_key_violations(target) == violations_before

    _alembic(url, "upgrade", REVISION)
    assert "first_login_at" in _columns(target)
