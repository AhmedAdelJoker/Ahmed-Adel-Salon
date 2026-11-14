"""One barber, one chair: a database guard against double booking.

Revision ID: c4d9e2f6a8b3
Revises: b3c8d1e5f7a2
Create Date: 2026-10-28

The bug
-------
`create_public_booking` in `app/api/v1/endpoints/booking_public.py` is
check-then-act, and the check is a Python query:

    available = booking_scheduler.get_available_barbers_for_slot(...)
    ...
    appointment = Appointment(...); db.add(appointment); db.commit()

Two `POST /public/booking` calls that arrive in the same instant both read the
same busy list, both conclude the slot is free, and both insert. The public site
has no idempotency key and the table had no constraint, so the second one
succeeded and the barber was booked into two chairs at once.

`appointments` already carried two indexes over these columns --
`ix_appointments_barber_date` and `ix_appointments_barber_date_status` -- and
neither is unique. They answer "find this barber's day"; they cannot answer
"at most one booking may hold this slot". An index and a constraint look alike
in a model file and behave nothing alike.

The partial predicate
---------------------
The index covers only the statuses that still occupy the chair. A cancelled
booking must not keep blocking the slot it gave back, so the predicate excludes
them -- and it is written as a deny-list of the releasing statuses rather than
an allow-list of the occupying ones, matching `app/core/booking_status.py`. The
lifecycle has more states than the three the old allow-list knew about
(`in-service`, `ready_for_payment`, `completed` all pass through it), and a
booking being cut someone's hair is the least free slot there is. An allow-list
makes a status that is missing from it look free; a deny-list makes it look
busy, which is the only safe direction to be wrong in.

What this does and does not catch
---------------------------------
It catches two bookings for the *same* start time. It cannot express "these two
intervals overlap", which needs an exclusion constraint over a tstzrange with a
gist index -- PostgreSQL-only, and SQLite has no equivalent. The overlap case
stays with the scheduler, which now also takes a row lock on the barber before
it asks, so the two engines keep the same guarantee they had and the one they
were missing gets added.

Pre-existing duplicates
-----------------------
If a deployment already has two live bookings in one slot, the constraint cannot
be created. This migration stops and prints them rather than choosing one to
cancel: an appointment is a customer's booked time, and silently dropping one to
make a DDL statement succeed destroys the thing the constraint exists to
protect.

Scope
-----
PostgreSQL and SQLite, the two dialects `backend_dialect_support` already
narrows over.
"""

from alembic import op
import sqlalchemy as sa

revision = "c4d9e2f6a8b3"
down_revision = "b3c8d1e5f7a2"
branch_labels = None
depends_on = None

INDEX = "uq_appointments_barber_slot"
COLUMNS = ["barber_id", "appointment_date", "appointment_time"]
PREDICATE = "status NOT IN ('cancelled', 'auto_cancelled', 'no_show')"


def _is_postgres(conn) -> bool:
    return conn.dialect.name == "postgresql"


def _has_index(conn, name: str) -> bool:
    if _is_postgres(conn):
        sql = "SELECT 1 FROM pg_indexes WHERE indexname = :n"
    else:
        sql = "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = :n"
    return bool(conn.execute(sa.text(sql), {"n": name}).fetchone())


def _live_slot_duplicates(conn) -> list[tuple]:
    # `GROUP_CONCAT` is SQLite; PostgreSQL spells the same aggregate
    # `STRING_AGG` and takes the separator. One list, built per dialect, rather
    # than a query that parses on one engine and dies on the other.
    ids = (
        "STRING_AGG(id::text, ',') AS ids"
        if _is_postgres(conn)
        else "GROUP_CONCAT(id) AS ids"
    )
    return conn.execute(
        sa.text(
            f"SELECT barber_id, appointment_date, appointment_time, "
            f"       COUNT(*), {ids} "
            f"FROM appointments "
            f"WHERE {PREDICATE} "
            f"GROUP BY barber_id, appointment_date, appointment_time "
            f"HAVING COUNT(*) > 1 "
            f"ORDER BY barber_id, appointment_date, appointment_time"
        )
    ).fetchall()


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("appointments"):
        return
    if _has_index(bind, INDEX):
        return

    duplicates = _live_slot_duplicates(bind)
    if duplicates:
        lines = "\n".join(
            f"  barber {row[0]} at {row[1]} {row[2]} -> appointment ids {row[4]}"
            for row in duplicates
        )
        raise RuntimeError(
            f"Cannot create {INDEX}: {len(duplicates)} appointment slot(s) "
            "already hold more than one live booking.\n"
            f"{lines}\n\n"
            "Resolve each conflict in the application -- move one booking to a "
            "free slot, or cancel it and tell the customer -- then re-run this "
            "migration. Cancelling a customer's appointment automatically to "
            "make a DDL statement succeed is not a decision this migration "
            "gets to make."
        )

    if _is_postgres(bind):
        op.create_index(
            INDEX,
            "appointments",
            COLUMNS,
            unique=True,
            postgresql_where=sa.text(PREDICATE),
        )
    else:
        op.create_index(
            INDEX,
            "appointments",
            COLUMNS,
            unique=True,
            sqlite_where=sa.text(PREDICATE),
        )


def downgrade():
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("appointments"):
        return
    if not _has_index(bind, INDEX):
        return
    op.drop_index(INDEX, table_name="appointments")
