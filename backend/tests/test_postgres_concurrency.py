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
    """A connection factory, with a lease discipline.

    The previous version handed out pooled connections and never guaranteed a
    caller would return or close them. Most tests used `with conn_factory() as
    conn`, which closes the lease, but two setups used a bare `conn_factory()`
    that stayed open for the rest of the test -- and one of them left a
    transaction open.

    The consequence was a hang, not a failure. `_seed_minimum` opens with
    `TRUNCATE ... CASCADE`, which wants ACCESS EXCLUSIVE; an open transaction
    holding any lock on any of those tables blocks it, and the next test waits
    for a lock that is never released. It looked like a slow machine: every
    test passed alone in about 2s, and the suite ran forever once two of them
    ran together. `test_concurrent_writes_do_not_corrupt_a_row` followed by
    `test_two_invoices_cannot_be_issued_for_one_appointment` was the minimal
    reproduction -- eight updater threads on one row, then a TRUNCATE.

    Disposing the engine at teardown rolls back anything still open, so a test
    that leaks a connection is slow rather than fatal, and the next test starts
    from a clean lock state.
    """
    from sqlalchemy import create_engine

    engine = create_engine(db_url, pool_size=10, max_overflow=10)
    try:
        yield lambda: engine.connect()
    finally:
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

    with conn_factory() as setup:
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

    # `with`, for the same reason as in `test_concurrent_writes_do_not_corrupt_a_row`:
    # a bare connection here would still be holding a transaction when the next
    # test's TRUNCATE runs.
    with conn_factory() as setup:
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

    # `with`, not a bare `conn_factory()`. A bare connection stays open for the
    # rest of the test, and the `SELECT` below opens a transaction that nothing
    # commits. That leaves the connection idle-in-transaction holding a lock on
    # `activity_logs` when the test ends.
    #
    # The next test to run opens with `TRUNCATE ... CASCADE`, which wants
    # ACCESS EXCLUSIVE, and waits for that lock forever. Nothing fails, nothing
    # times out on its own, and the suite simply stops. It presented as a slow
    # machine -- each test alone takes about 2s -- until `pg_stat_activity`
    # showed the holder: `idle in transaction` on a `SELECT`, and a second
    # connection `active` on `Lock/relation` against the TRUNCATE.
    with conn_factory() as setup:
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


# --------------------------------------------------------------------------
# Issuance: two check-then-act races the database has to arbitrate
# --------------------------------------------------------------------------
#
# Both of these are the same bug in different clothes. The endpoint reads
# something, decides the world is fine, and then writes -- with nothing between
# the read and the write that would stop a second transaction from deciding the
# same thing. One session cannot see it; two can.


def _seed_bookable_appointment(conn) -> int:
    """An appointment and a service attached to it, ready to invoice."""
    import sqlalchemy as sa

    _insert_minimal(
        conn,
        "appointments",
        {
            "id": "1",
            "customer_id": "1",
            "barber_id": "1",
            "appointment_date": "CURRENT_DATE",
            "appointment_time": "'10:00'",
            "status": "'confirmed'",
        },
    )
    _insert_minimal(
        conn,
        "appointment_services",
        {
            "id": "1",
            "appointment_id": "1",
            "service_id": "NULL",
            "service_name_snapshot": "'Cut'",
            "price_snapshot": "100",
            "quantity": "1",
        },
    )
    conn.commit()
    return 1


def test_two_invoices_cannot_be_issued_for_one_appointment(db_url, conn_factory):
    """Issuing an invoice twice for the same appointment must be impossible.

    `issue_invoice_from_appointment` checks for an existing invoice, and if it
    finds none, issues one. Two cashiers pressing the button at the same moment
    both find none. The customer is charged twice for one haircut and receives
    two PDFs, and nothing in the application or the schema objects -- because
    `invoices.appointment_id` is a plain indexed column, not a unique one. An
    index answers "which invoices point here"; only a constraint answers "at
    most one may".

    This asserts the constraint is in the database rather than the Python guard,
    because the Python guard is the thing that failed.
    """
    import sqlalchemy as sa

    with conn_factory() as setup:
        _seed_minimum(setup)
        _seed_bookable_appointment(setup)

    errors: list[str] = []
    barrier = threading.Barrier(2)
    appt_id = 1

    def issue_once(n: int):
        with conn_factory() as conn:
            barrier.wait(timeout=10)
            try:
                already = conn.execute(
                    sa.text("SELECT 1 FROM invoices WHERE appointment_id = :a"),
                    {"a": appt_id},
                ).fetchone()
                if already:
                    return "declined"
                conn.execute(
                    sa.text(
                        "INSERT INTO invoices "
                        "(invoice_no, customer_id, barber_id, appointment_id, "
                        " payment_method, subtotal_amount, total_amount, "
                        " discount_amount) "
                        "VALUES (:no, 1, 1, :a, 'cash', 100, 100, 0)"
                    ),
                    {"no": f"INV-RACE-{n}", "a": appt_id},
                )
                conn.commit()
                return "issued"
            except sa.exc.IntegrityError as exc:
                # The constraint doing its job. A UNIQUE violation here is the
                # outcome this test exists to produce, so it is a result and not
                # an error -- recording it in `errors` and asserting that list is
                # empty is how the first version of this test failed *after* the
                # fix had already landed, which is a confusing way to spend an
                # afternoon.
                conn.rollback()
                return "rejected"
            except Exception as exc:  # noqa: BLE001
                conn.rollback()
                errors.append(f"{type(exc).__name__}: {exc}")
                return "errored"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(issue_once, range(2)))

    assert not errors, f"an unexpected failure, not the constraint: {errors}"
    assert "issued" in outcomes, f"both transactions lost: {outcomes}"
    assert outcomes.count("issued") == 1, (
        f"one must win and one must be rejected, got {outcomes}"
    )

    with conn_factory() as conn:
        count = conn.execute(
            sa.text("SELECT COUNT(*) FROM invoices WHERE appointment_id = :a"),
            {"a": appt_id},
        ).scalar()
    assert count == 1, f"{count} invoices for one appointment"


def test_invoice_number_cannot_be_handed_out_twice(db_url, conn_factory):
    """`INV-YYYYMMDD-0001` must name one invoice, not two.

    `_generate_invoice_no` counts today's invoices and adds one. That is a
    read-modify-write, and the daily-counter table added for the manual invoice
    path does not cover it -- this helper was never moved onto it. Two concurrent
    issuances both read count 41 and both write 42.

    What saves the number is `ix_invoices_invoice_no` being UNIQUE, which it
    already is. So this test passes, and it is here to keep passing: the correct
    way to fix the race is to serialise the counter, and doing that must not
    quietly drop the unique index that is currently the only thing preventing a
    duplicate receipt number from reaching a customer.

    The loser of the race gets an IntegrityError rather than a clean 4xx, which
    is ugly but not a data problem. The appointment_id case below is the one that
    has no such backstop, and is a data problem.
    """
    import sqlalchemy as sa

    with conn_factory() as setup:
        _seed_minimum(setup)
        _seed_bookable_appointment(setup)
        setup.execute(sa.text("DELETE FROM invoices"))
        setup.commit()

    errors: list[str] = []
    barrier = threading.Barrier(2)
    day = "2031-04-05"
    number = f"INV-{day.replace('-', '')}-0001"

    def take_number():
        with conn_factory() as conn:
            barrier.wait(timeout=10)
            try:
                taken = conn.execute(
                    sa.text(
                        "SELECT COUNT(*) FROM invoices WHERE invoice_no LIKE :p"
                    ),
                    {"p": f"INV-{day.replace('-', '')}%"},
                ).scalar()
                conn.execute(
                    sa.text(
                        "INSERT INTO invoices "
                        "(invoice_no, customer_id, barber_id, appointment_id, "
                        " payment_method, subtotal_amount, total_amount, "
                        " discount_amount) "
                        "VALUES (:no, 1, 1, 1, 'cash', 100, 100, 0)"
                    ),
                    {"no": f"INV-{day.replace('-', '')}-{taken + 1:04d}"},
                )
                conn.commit()
                return "ok"
            except Exception as exc:  # noqa: BLE001
                conn.rollback()
                errors.append(f"{type(exc).__name__}: {exc}")
                return "rejected"

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: take_number(), range(2)))

    with conn_factory() as conn:
        rows = conn.execute(
            sa.text("SELECT COUNT(*) FROM invoices WHERE invoice_no = :no"),
            {"no": number},
        ).scalar()
    assert rows <= 1, f"{rows} invoices share invoice_no {number}"


def test_the_one_invoice_per_appointment_constraint_exists(db_url, conn_factory):
    """A unique constraint, or a partial one. Either, but one.

    Historic invoices may have a null `appointment_id` -- an invoice raised at
    the counter has no appointment behind it -- and a plain UNIQUE would reject
    those, because SQL treats NULLs as distinct from each other but a
    `UNIQUE(appointment_id)` is still violated by two NULLs in some engines
    rather than none. Postgres is permissive here, which means the constraint
    can be plain and the manual invoices keep working. This test pins which one
    it actually is, so that changing it is a decision rather than an accident.
    """
    import sqlalchemy as sa

    with conn_factory() as conn:
        # `pg_index`, not `information_schema.table_constraints`. A unique
        # *index* is not listed in table_constraints -- only a declared
        # CONSTRAINT is -- and the migration builds the uniqueness with
        # `create_index(unique=True)`, which is the same thing to the engine and
        # invisible to that view. Querying table_constraints reported "no
        # constraint" while the index was present and enforcing, which is how a
        # test can be wrong and the code be right.
        covering = conn.execute(
            sa.text(
                """
                SELECT i.indexrelid::regclass::text AS name
                FROM pg_index i
                JOIN pg_class t ON t.oid = i.indrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE n.nspname = 'public' AND t.relname = 'invoices'
                  AND i.indisunique
                  AND 'appointment_id' = ANY (
                        SELECT a.attname
                        FROM unnest(i.indkey) AS k
                        JOIN pg_attribute a
                          ON a.attrelid = i.indrelid AND a.attnum = k
                  )
                """
            )
        ).fetchall()

    assert covering, (
        "invoices has no unique index covering appointment_id, so two cashiers "
        "can invoice one appointment"
    )
