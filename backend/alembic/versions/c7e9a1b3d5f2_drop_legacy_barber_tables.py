"""Drops the four tables the barber -> employee unification left behind.

`0de75d6f3a31` (unify_barber_to_employee) moved the staff data onto `employees`
and rebuilt every live table to point at it. It did not drop the four tables it
emptied, and `e7a2c4d6b8f1` explicitly declined to remove them, calling that a
separate decision. This is that decision: they are dropped.

What is in them, on a development database that has been running since May:
two rows in `barbers` (a display name and a creation timestamp), one row in
`barber_presence_logs`, and nothing in `barber_time_off` or
`barber_working_hours`. The real records are on `employees`, which is what the
API has read since the unification. `invoice_items_legacy_product_refs` is NOT
dropped here: it holds product references rescued from a rebuilt table in
`c5d6e7f8a9b0`, it is referenced by nothing, and it is not part of the same
question.

The guard below is the part that matters. On a database created before the
unification, `service_sessions.barber_id` still carries a foreign key to
`barbers` while the model has declared `employees` since 0de75d6f3a31. That is
stale schema, not a live relationship -- `service_sessions` has no rows that
depend on it -- but dropping `barbers` on top of it would leave a foreign key
pointing at a table that no longer exists. PostgreSQL refuses to create that
state on its own; SQLite does not, and would carry the dangling constraint until
something wrote to the table with enforcement on, at which point the insert
fails with "no such table: main.barbers" far from this migration.

So this checks first and stops with instructions instead of creating it. The
repair is `scripts/repoint_legacy_barber_fks.py`, which rebuilds the constraint
on a SQLite database; on PostgreSQL the migration below simply fails with the
database's own error, which says the same thing.
"""

from alembic import op
import sqlalchemy as sa

revision = "c7e9a1b3d5f2"
down_revision = "f8b3c5d7e9a2"
branch_labels = None
depends_on = None

#: The four tables, in the order they have to go: the two that carry a foreign
#: key to `barbers` before `barbers` itself.
LEGACY_TABLES = (
    "barber_time_off",
    "barber_working_hours",
    "barber_presence_logs",
    "barbers",
)

COLUMNS = {
    "barbers": (
        ("id", sa.Integer(), True),
        ("display_name", sa.String(), False),
        ("created_at", sa.DateTime(), True),
    ),
    "barber_presence_logs": (
        ("id", sa.Integer(), True),
        ("barber_id", sa.Integer(), False),
        ("status", sa.String(), False),
        ("created_at", sa.DateTime(), True),
    ),
    "barber_time_off": (
        ("id", sa.Integer(), True),
        ("barber_id", sa.Integer(), False),
        ("off_date", sa.Date(), False),
        ("reason", sa.String(), False),
    ),
    "barber_working_hours": (
        ("id", sa.Integer(), True),
        ("barber_id", sa.Integer(), False),
        ("day_of_week", sa.Integer(), False),
        ("start_time", sa.String(), False),
        ("end_time", sa.String(), False),
        ("is_active", sa.Boolean(), False),
    ),
}

PRIMARY_KEY = {
    "barbers": "id",
    "barber_presence_logs": "id",
    "barber_time_off": "id",
    "barber_working_hours": "id",
}


def _tables_still_referencing_barbers(bind) -> list[str]:
    """Live tables, other than the four being dropped, with a key into `barbers`."""
    inspector = sa.inspect(bind)
    legacy = set(LEGACY_TABLES)
    out_of_scope = []
    for name in inspector.get_table_names():
        if name in legacy:
            continue
        for fk in inspector.get_foreign_keys(name):
            if fk.get("referred_table") == "barbers":
                out_of_scope.append(name)
    return sorted(set(out_of_scope))


def upgrade() -> None:
    bind = op.get_bind()

    stale = _tables_still_referencing_barbers(bind)
    if stale:
        raise RuntimeError(
            f"refusing to drop `barbers`: {stale} still carry a foreign key to it. "
            "That is pre-unification schema -- the model has declared "
            "`ForeignKey('employees.id')` since 0de75d6f3a31. On SQLite the drop "
            "would succeed and leave a dangling constraint, which fails later as "
            "'no such table: main.barbers' on an insert. Repair it first: "
            "python scripts/repoint_legacy_barber_fks.py"
        )

    for table in LEGACY_TABLES:
        op.drop_table(table)


def downgrade() -> None:
    """Recreates the four tables. The rows dropped above do not come back.

    The recreated tables carry their columns and their original shape, which is
    what `downgrade` has to promise; the two rows and one log line they held on a
    development database were copies of records that already exist on
    `employees`, so nothing was unique to this history.
    """
    for table in LEGACY_TABLES:
        op.create_table(
            table,
            sa.Column("id", sa.Integer(), nullable=not COLUMNS[table][0][2]),
            *[
                sa.Column(name, type_, nullable=nullable)
                for name, type_, nullable in COLUMNS[table][1:]
            ],
            sa.PrimaryKeyConstraint(PRIMARY_KEY[table]),
        )
        if table in ("barber_time_off", "barber_working_hours"):
            op.create_index(f"ix_{table}_barber_id", table, ["barber_id"])
