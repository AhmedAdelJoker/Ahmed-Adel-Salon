"""Make stock deduction idempotent with a source reference.

``inventory_logs`` gains ``source_type`` / ``source_id`` plus a unique
constraint over (source_type, source_id, product_id).

The defect this closes
---------------------
Stock was deducted from three independent code paths — creating a service
session, completing it, and issuing the invoice — and nothing recorded which
document had already been applied. A single sale could decrement the same
product two or three times. The quantities were wrong, the ``inventory_logs``
rows looked individually plausible, and there was no field to query to find out.

Why a constraint and not an application check
---------------------------------------------
"Have I already deducted this?" is a read followed by a write, so two
concurrent finalisations of the same invoice can both answer "no" before either
commits. Only a uniqueness constraint holds under that race, so the guarantee
lives in the schema and the service treats a violation as "already applied".

Both columns are nullable. Manual stock edits from the inventory screen have no
source document, and SQL treats each NULL as distinct, so those rows are never
compared against one another. Existing rows all have NULL here, which is why
this runs against a populated database without a rebuild.

Revision ID: b8e3f1a2c4d7
Revises: a7b2c3d4e5f6
"""

from alembic import op
import backend_dialect_support as ds
import sqlalchemy as sa

revision = "b8e3f1a2c4d7"
down_revision = "a7b2c3d4e5f6"
branch_labels = None
depends_on = None

CONSTRAINT = "uq_inventory_logs_source_product"


def _columns(conn, table: str) -> set[str]:
    # `pragma_table_info` is a SQLite table-valued function with no PostgreSQL
    # equivalent. On Postgres it raises UndefinedFunction, which reads like a
    # missing table rather than like dialect-specific syntax. See
    # alembic/dialect_support.py for the portable form.
    return set(ds.columns_of(conn, table))


def _table_exists(conn, table: str) -> bool:
    return ds.table_exists(conn, table)


def _index_exists(conn, name: str) -> bool:
    return ds.index_exists(conn, name)


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "inventory_logs"):
        return

    existing = _columns(conn, "inventory_logs")

    if "source_type" not in existing:
        op.add_column(
            "inventory_logs",
            sa.Column("source_type", sa.String(length=30), nullable=True),
        )
    if "source_id" not in existing:
        op.add_column(
            "inventory_logs",
            sa.Column("source_id", sa.Integer(), nullable=True),
        )

    # Indexes back the idempotency lookup, which runs once per invoice line and
    # per ingredient, so it is on the hot path of every sale.
    for name, column in (
        ("ix_inventory_logs_source_type", "source_type"),
        ("ix_inventory_logs_source_id", "source_id"),
    ):
        if not _index_exists(conn, name):
            op.create_index(name, "inventory_logs", [column], unique=False)

    # `batch_alter_table` recreates the table on SQLite, which is the only way
    # to add a constraint there; on Postgres it emits plain ALTER TABLE.
    with op.batch_alter_table("inventory_logs") as batch_op:
        batch_op.create_unique_constraint(
            CONSTRAINT, ["source_type", "source_id", "product_id"]
        )


def downgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "inventory_logs"):
        return

    for name in ("ix_inventory_logs_source_type", "ix_inventory_logs_source_id"):
        if _index_exists(conn, name):
            op.drop_index(name, table_name="inventory_logs")

    with op.batch_alter_table("inventory_logs") as batch_op:
        batch_op.drop_constraint(CONSTRAINT, type_="unique")

    for column in ("source_type", "source_id"):
        if column in _columns(conn, "inventory_logs"):
            with op.batch_alter_table("inventory_logs") as batch_op:
                batch_op.drop_column(column)
