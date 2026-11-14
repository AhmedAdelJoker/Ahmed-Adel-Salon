"""Barber dashboard schema: service start time, notification preferences, indexes.

Everything here was, until now, applied only by `app/db/runtime_schema.py` at
application startup. That file is a safety net for development databases, not a
schema history: it runs `ALTER TABLE` / `CREATE INDEX` guarded by existence
checks, so it converges on the right shape but leaves no record of when or why
each change landed. A database that is built by `Base.metadata.create_all` (which
is what the test suite does) gets the model declarations and never runs
`runtime_schema` at all, and a fresh production database built from
`alembic upgrade head` would come up **missing** all of it.

This migration is that missing record. It is deliberately **idempotent**:
`runtime_schema` has already applied most of this to any developer database that
has booted the app since the change, so `upgrade` inspects before it writes and
skips whatever is already in place. Running it on a database that went through
`runtime_schema` and on a pristine one produces the same end state.

The four changes, and the defect each one closed:

`appointments.started_at`
    `GET /barber/appointments/{id}` hardcoded `"started_at": None`, so the
    workstation's service timer was rebuilt as zero on every page load -- a
    barber who refreshed mid-cut lost the running time. The column is stamped
    once, on the first transition into `in-service`.

`preferences.notification_preferences`
    `/barber/notification-settings` accepted a flat payload and silently dropped
    every field except the master `notifications_enabled` switch, so toggling
    "new appointment" and "promotions" never persisted. The nested form was
    accepted and never stored at all.

`ix_invoices_barber_draft_created` on `(barber_id, is_draft, created_at)`
    `/barber/earnings-summary` filters on all three. The pre-existing
    `ix_invoices_barber_created` is `(barber_id, created_at)`, so `is_draft`
    could only be applied as a residual filter after the index range was already
    chosen. Column order matters: the two equality columns come before the range
    column, otherwise the range bounds the scan before `is_draft` narrows it.

`ix_appointment_services_appointment` and `ix_salary_advances_employee_deducted`
    Both are supporting indexes for `selectinload` batches and for the
    undeducted-advance sum in `/barber/stats`. Without them each of those is a
    full scan of the child table on every dashboard load.
"""

from alembic import op
import sqlalchemy as sa

revision = "b4f1c2d8a90e"
down_revision = "c7e9a1b3d5f2"
branch_labels = None
depends_on = None


#: ``(index_name, table, columns)``. Declared as data so `upgrade` and `downgrade`
#: agree on the names by construction and cannot drift apart.
INDEXES = (
    ("ix_invoices_barber_draft_created", "invoices", ("barber_id", "is_draft", "created_at")),
    ("ix_appointment_services_appointment", "appointment_services", ("appointment_id",)),
    ("ix_salary_advances_employee_deducted", "salary_advances", ("employee_id", "is_deducted")),
)


def _has_table(bind, name: str) -> bool:
    return name in sa.inspect(bind).get_table_names()


def _has_column(bind, table: str, column: str) -> bool:
    if not _has_table(bind, table):
        return False
    return column in {c["name"] for c in sa.inspect(bind).get_columns(table)}


def _has_index(bind, name: str) -> bool:
    inspector = sa.inspect(bind)
    for table in inspector.get_table_names():
        if name in {i["name"] for i in inspector.get_indexes(table)}:
            return True
    return False


def upgrade() -> None:
    bind = op.get_bind()

    # `preferences` did not exist under this name in some pre-unification
    # databases. Skip rather than fabricate a table here: runtime_schema and the
    # model are the source of truth for its shape, and a table created here
    # without its own columns would be worse than an absent one.
    if _has_table(bind, "preferences"):
        if not _has_column(bind, "preferences", "notification_preferences"):
            # The model declares JSON; on SQLite that is stored as TEXT, which is
            # what `runtime_schema` already wrote, so the two paths agree.
            op.add_column(
                "preferences",
                sa.Column("notification_preferences", sa.JSON(), nullable=True),
            )

    if _has_table(bind, "appointments") and not _has_column(
        bind, "appointments", "started_at"
    ):
        op.add_column(
            "appointments",
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        )

    for name, table, columns in INDEXES:
        if not _has_table(bind, table):
            continue
        if _has_index(bind, name):
            continue
        op.create_index(name, table, list(columns))


def downgrade() -> None:
    bind = op.get_bind()

    for name, _table, _columns in reversed(INDEXES):
        if _has_index(bind, name):
            op.drop_index(name)

    # `started_at` is dropped rather than preserved: after this revision the
    # endpoint reads it, and leaving it would leave the API returning a column
    # the database is no longer guaranteed to have.
    if _has_table(bind, "appointments") and _has_column(bind, "appointments", "started_at"):
        op.drop_column("appointments", "started_at")

    # `notification_preferences` is left in place. Unlike `started_at` nothing
    # breaks without it -- the endpoint reports the flat defaults when the
    # column is absent -- and it holds per-barber settings that were entered
    # after this revision. Dropping user configuration on a downgrade is not a
    # fair trade for schema symmetry.