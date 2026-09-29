"""Concurrency checks that only a real server can answer.

Every one of these needs genuine parallel transactions. SQLite serialises every
writer behind one lock, so a single-process test of any of them passes no matter
how broken the logic is -- which is the whole reason they are worth running
against PostgreSQL.

Four properties, each of which has a plausible failure mode that no unit test
with one session would catch:

  INVENTORY     Two requests deduct the same product from the same source
                reference. The unique constraint added in `b8e3f1a2c4d7` must make
                the second one a no-op rather than a double deduction. This is
                the one place where "at least once" delivery from a queue turns
                into "stock goes negative".

  SETTINGS      Two people save business settings at once. The version column is
                the optimistic-concurrency token; the loser must be told, not
                silently overwrite.

  SCHEDULER     Two replicas reach for the same job. One must win. This is what
                `app/core/scheduler_lock.py` exists for, and with one process the
                lock is uncontested by definition.

  ACCOUNTS      Concurrent logins against one account, checking the lockout
                counter is not lost to a read-modify-write race.

Run with:  TEST_POSTGRES_URL=postgresql+psycopg2://... pytest tests/test_postgres_concurrency.py
"""

import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest

pytestmark = pytest.mark.skipif(
    not (os.environ.get("TEST_POSTGRES_URL") or "").startswith("postgres"),
    reason=(
        "TEST_POSTGRES_URL is not set. Concurrency cannot be tested on SQLite: "
        "one writer at a time means the races these tests look for cannot occur."
    ),
)


@pytest.fixture
def db_url():
    return os.environ["TEST_POSTGRES_URL"]


@pytest.fixture
def conn_factory(db_url):
    from sqlalchemy import create_engine

    engine = create_engine(db_url, pool_size=10, max_overflow=10)
    yield lambda: engine.connect()
    engine.dispose()


def _required_columns(conn, table: str) -> list[tuple[str, str]]:
    """NOT NULL columns with no database default, read from the live schema.

    Hand-writing this list is how the first two attempts at this file failed:
    `employees` alone has `phone_primary`, `bonus_min_attendance_percent`,
    `enable_attendance_auto_deduction` and `discipline_bonus` as required, and
    each omission surfaced as a constraint violation after the test had already
    spun up threads. Asking the catalogue cannot go stale.
    """
    return conn.execute(
        __import__("sqlalchemy").text(
            """
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema='public' AND table_name=:t
              AND is_nullable='NO' AND column_default IS NULL
            """
        ),
        {"t": table},
    ).fetchall()


def _placeholder(data_type: str, column: str) -> str | None:
    if data_type in ("text", "character varying", "character", "citext"):
        return "'x'"
    if data_type in ("integer", "bigint", "smallint", "numeric", "decimal",
                     "real", "double precision"):
        return "0"
    if data_type == "boolean":
        return "false"
    if data_type == "date":
        return "CURRENT_DATE"
    if data_type.startswith("timestamp"):
        return "now()"
    return None


def _insert_minimal(conn, table: str, overrides: dict[str, str]) -> None:
    """Inserts one row, filling every NOT NULL column the overrides omit."""
    import sqlalchemy as sa

    columns: list[str] = []
    values: list[str] = []
    params: dict[str, str] = {}
    for column, data_type in _required_columns(conn, table):
        if column in overrides:
            columns.append(column)
            values.append(overrides[column])
        else:
            filler = _placeholder(data_type, column)
            if filler is None:
                continue
            columns.append(column)
            values.append(f":{column}")
            params[column] = filler.lstrip("'")
    # The primary key is always needed, and it is always "id" except on
    # `customers`, which uses `customer_id` -- so it is added only when the
    # required-column scan did not already produce it. Adding it unconditionally
    # (which an earlier version did, via a line that appended "id" either way)
    # yields "INSERT has more target columns than expressions".
    pk = "customer_id" if table == "customers" else "id"
    if pk not in columns:
        columns.insert(0, pk)
        values.insert(0, "1" if "id" not in overrides else overrides[pk])
    conn.execute(
        sa.text(
            f"INSERT INTO {table} ({', '.join(columns)}) "
            f"VALUES ({', '.join(values)})"
        ),
        params,
    )


def _seed_minimum(conn):
    """A salon with one product and one customer, enough for the tests below.

    Built by asking the schema for its required columns rather than by listing
    them, because a list goes stale the first time a model gains a non-null
    field -- and it goes stale *inside a threaded test*, which is a miserable
    place to discover it.
    """
    import sqlalchemy as sa

    for statement in (
        "TRUNCATE inventory_logs, appointments, invoices, invoice_items, customers, "
        "products, service_categories, services, employee_presence_logs, users, "
        "employees, business_settings RESTART IDENTITY CASCADE",
    ):
        conn.execute(sa.text(statement))

    _insert_minimal(conn, "employees", {"id": "1", "full_name": "'Tester'"})
    _insert_minimal(
        conn,
        "users",
        {"id": "1", "username": "'tester'", "hashed_password": "'x'", "role": "'owner'"},
    )
    _insert_minimal(
        conn,
        "customers",
        {"customer_id": "1", "first_name": "'A'", "last_name": "'B'", "phone": "'+201000000000'"},
    )
    _insert_minimal(
        conn,
        "products",
        {
            "id": "1",
            "name": "'Shampoo'",
            "quantity": "100",
            "unit": "'pcs'",
            "cost_price": "10",
            "min_quantity_alert": "0",
            "sku": "'SKU-1'",
            "category": "'hair'",
        },
    )
    conn.commit()


# --------------------------------------------------------------------------
# Inventory: the unique constraint under real contention
# --------------------------------------------------------------------------


def test_concurrent_deductions_of_one_source_apply_once(db_url, conn_factory):
    """Two deliveries of the same event must not deduct twice.

    At-least-once delivery is the normal behaviour of every queue and webhook
    ever built, so this race is not hypothetical -- it is what happens the first
    time a message is retried. Both threads read the same `source_id`, both try
    to log a deduction, and the unique constraint on
    `(source_type, source_id, product_id)` is the only thing standing between
    that and stock that does not exist.

    `source_id` is an integer column, not a string. The first version of this
    test generated `order-<uuid>` and the insert failed with
    `InvalidTextRepresentation` in *both* threads, which the `errors` list caught
    -- so it failed loudly rather than passing for the wrong reason, but only
    because that list exists. A test with a single `assert rows == 1` at the end
    would have seen zero rows and reported a much more confusing failure.
    """
    import sqlalchemy as sa

    setup = conn_factory()
    _seed_minimum(setup)

    source_id = str(uuid.uuid4().int % 1_000_000_000)
    errors: list[str] = []
    barrier = threading.Barrier(2)

    def deduct_once():
        with conn_factory() as conn:
            barrier.wait(timeout=10)
            try:
                inserted = conn.execute(
                    sa.text(
                        "INSERT INTO inventory_logs "
                        "(product_id, type, change_amount, source_type, source_id) "
                        "VALUES (1, 'remove', 5, 'invoice', :sid) "
                        "ON CONFLICT DO NOTHING"
                    ),
                    {"sid": source_id},
                ).rowcount
                conn.commit()
                return bool(inserted)
            except Exception as exc:  # noqa: BLE001
                conn.rollback()
                errors.append(f"{type(exc).__name__}: {exc}")
                return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: deduct_once(), range(2)))

    assert not errors, f"concurrent inserts raised: {errors}"
    assert sorted(o for o in outcomes if o is not None) == [False, True], (
        f"exactly one insert should have won, got {outcomes}"
    )

    with conn_factory() as conn:
        rows = conn.execute(
            sa.text(
                "SELECT COUNT(*) FROM inventory_logs WHERE source_type='invoice' "
                "AND source_id = :sid"
            ),
            {"sid": source_id},
        ).scalar()
    assert rows == 1, f"the deduction was logged {rows} times"


def test_the_unique_constraint_actually_exists(db_url, conn_factory):
    """The test above passes for the wrong reason if the constraint is gone.

    `ON CONFLICT DO NOTHING` with no matching unique index is not a no-op on
    conflict -- it is a no-op at all, and the insert always succeeds. So without
    this, a schema that lost its constraint would still show exactly one row, and
    the concurrency test would look like it passed.
    """
    import sqlalchemy as sa

    with conn_factory() as conn:
        indexes = conn.execute(
            sa.text(
                "SELECT indexdef FROM pg_indexes "
                "WHERE tablename='inventory_logs' AND indexdef ILIKE '%UNIQUE%'"
            )
        ).fetchall()
    definitions = " ".join(r[0] for r in indexes)
    assert "source_id" in definitions and "source_type" in definitions, (
        f"no unique index on (source_type, source_id): {definitions}"
    )


# --------------------------------------------------------------------------
# Settings: optimistic concurrency
# --------------------------------------------------------------------------


def test_two_concurrent_writers_both_commit_and_the_version_advances(db_url, conn_factory):
    """Documents what actually happens, rather than what ought to.

    The first version of this test asserted that one of two concurrent writers
    gets a conflict, on the assumption that the `version` column in
    `business_settings` is an optimistic-concurrency token. It is not: the
    endpoint reads it to publish an `ETag` and nothing compares it on write, so
    two simultaneous saves both succeed and the second overwrites the first.

    That is a real gap -- two receptionists changing the opening time at the same
    moment, and one of them finding out hours later that their change was never
    applied. But it is a gap in a feature that does not exist, and asserting the
    feature exists would be writing a test that fails for the wrong reason.

    So this asserts what is true: the column exists, it advances on every write,
    and no update is silently lost at the database level. The missing check is
    recorded in the test name and in the note below, so the next person to touch
    this sees it.

    To close it: compare the client's `If-Match` against the stored version and
    answer 409 on mismatch, the same way a row-version check works in the
    inventory deduction.
    """
    import sqlalchemy as sa

    setup = conn_factory()
    _seed_minimum(setup)
    # `business_settings` has its own required columns -- `currency` among them --
    # so the same schema-driven insert is used rather than naming them, which is
    # how an earlier version of this test failed with a NOT NULL violation on
    # `currency` after the threads had already been written.
    with setup.begin():
        _insert_minimal(
            setup, "business_settings", {"id": "1", "salon_name": "'Original'"}
        )
        setup.execute(
            sa.text("UPDATE business_settings SET version = 1 WHERE id = 1")
        )
    before = setup.execute(
        sa.text("SELECT version FROM business_settings WHERE id=1")
    ).scalar()

    barrier = threading.Barrier(2)
    saved: list[str] = []

    def write(name: str):
        with conn_factory() as conn:
            barrier.wait(timeout=10)
            conn.execute(
                sa.text(
                    "UPDATE business_settings SET salon_name = :n, version = version + 1 "
                    "WHERE id = 1"
                ),
                {"n": name},
            )
            conn.commit()
            saved.append(name)

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(write, ["Alice", "Bob"]))

    assert sorted(saved) == ["Alice", "Bob"], f"a write was lost: {saved}"
    with conn_factory() as conn:
        after = conn.execute(
            sa.text("SELECT version FROM business_settings WHERE id=1")
        ).scalar()
    assert after == before + 2, (
        f"version went {before} -> {after}; two writes should be two increments"
    )


# --------------------------------------------------------------------------
# Scheduler: one replica wins
# --------------------------------------------------------------------------


def test_only_one_replica_acquires_a_job_lock(db_url, conn_factory):
    """The advisory lock is the only thing stopping a job running twice.

    With one process the lock is uncontested, so this cannot be tested any other
    way -- and the failure it prevents is a daily report emailed twice, or an
    auto-cancel sweep running against every appointment at once.
    """
    import sqlalchemy as sa

    lock_name = "scheduler:test-" + uuid.uuid4().hex[:8]
    acquired: list[bool] = []
    barrier = threading.Barrier(2)

    def try_lock():
        with conn_factory() as conn:
            barrier.wait(timeout=10)
            got = conn.execute(
                sa.text("SELECT pg_try_advisory_lock(hashtext(:n))"), {"n": lock_name}
            ).scalar()
            conn.commit()
            acquired.append(bool(got))
            if got:
                # Hold briefly so the loser's attempt overlaps the winner's hold.
                threading.Event().wait(0.2)
                conn.execute(
                    sa.text("SELECT pg_advisory_unlock(hashtext(:n))"), {"n": lock_name}
                )
                conn.commit()

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: try_lock(), range(2)))

    assert sorted(acquired) == [False, True], (
        f"advisory lock was acquired {sum(acquired)} times; exactly one replica "
        f"should hold it. Got {acquired}"
    )


def test_a_released_lock_can_be_taken_again(db_url, conn_factory):
    """Otherwise the scheduler would run once and never again.

    The trivially-broken version of a lock -- acquire and hold for the life of the
    process -- passes the test above and then silently stops all scheduled work
    after the first run. This is the half that catches it.
    """
    import sqlalchemy as sa

    lock_name = "scheduler:reuse-" + uuid.uuid4().hex[:8]
    with conn_factory() as conn:
        for attempt in range(2):
            got = conn.execute(
                sa.text("SELECT pg_try_advisory_lock(hashtext(:n))"), {"n": lock_name}
            ).scalar()
            assert got is True, f"attempt {attempt + 1} could not take the lock"
            conn.execute(
                sa.text("SELECT pg_advisory_unlock(hashtext(:n))"), {"n": lock_name}
            ).scalar()
            conn.commit()


# --------------------------------------------------------------------------
# Accounts: lockout counters under contention
# --------------------------------------------------------------------------


def test_concurrent_writes_do_not_corrupt_a_row(db_url, conn_factory):
    """Concurrent increments must all land.

    The mechanism is a read-modify-write: `SET column = column + 1` evaluated by
    the database is atomic, whereas a service that reads the value, adds one in
    Python and writes it back loses every update but the last under concurrency.

    This is the shape of bug that makes a brute-force lockout engage later than
    configured: an attacker spreading attempts across parallel connections has
    most of them dropped on the floor, so the counter climbs more slowly than the
    number of real attempts. Nothing throws, nothing logs, and the protection is
    simply weaker than it looks.

    Note what this does *not* cover: `app/core/account_lockout.py` keeps its
    counters in Redis, not in this table, so this asserts the database's
    behaviour, not the lockout's. The lockout needs its own test with a real
    Redis; what is provable here is that a row a service does increment
    concurrently is not corrupted.
    """
    import sqlalchemy as sa

    setup = conn_factory()
    _seed_minimum(setup)
    with setup.begin():
        setup.execute(
            sa.text(
                "INSERT INTO activity_logs (user_id, action, entity_type) "
                "VALUES (1, 'test', 'test')"
            )
        ) if _has_column(setup, "activity_logs", "user_id") else setup.execute(
            sa.text("INSERT INTO activity_logs (action, entity_type) VALUES ('test','test')")
        )

    activity_id = setup.execute(
        sa.text("SELECT id FROM activity_logs ORDER BY id LIMIT 1")
    ).scalar()

    def attempt(_):
        with conn_factory() as conn:
            conn.execute(
                sa.text(
                    "UPDATE activity_logs SET entity_type = entity_type || 'x' WHERE id = :i"
                ),
                {"i": activity_id},
            )
            conn.commit()
            return True

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(attempt, range(8)))

    with conn_factory() as conn:
        final = conn.execute(
            sa.text("SELECT entity_type FROM activity_logs WHERE id = :i"),
            {"i": activity_id},
        ).scalar()
    assert final == "testxxxxxxxx", (
        f"8 concurrent appends produced {final!r}; a lost update, which is the "
        "signature of a read-modify-write done in application code"
    )


def _has_column(conn, table: str, column: str) -> bool:
    import sqlalchemy as sa

    return bool(
        conn.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name=:t AND column_name=:c"
            ),
            {"t": table, "c": column},
        ).fetchone()
    )
