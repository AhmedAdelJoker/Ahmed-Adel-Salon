"""Snapshot the customer name printed on each invoice.

Revision ID: a9c4e2f7b1d6
Revises: c4d9e2f6a8b3
Create Date: 2026-11-01

The POS now identifies a sale by the name typed at the till. The customer row
remains the loyalty/contact record, but a later rename (or a family member
using the same phone number) must not rewrite what an old receipt printed.
`customer_name_snapshot` stores that printed name at sale time.

Nullable on purpose: invoices issued before this migration have no snapshot,
and their serializers keep falling back to the joined customer row.
"""

from alembic import op
import sqlalchemy as sa


revision = "a9c4e2f7b1d6"
down_revision = "c4d9e2f6a8b3"
branch_labels = None
depends_on = None

COLUMN = "customer_name_snapshot"


def _has_column(conn, table: str, column: str) -> bool:
    inspector = sa.inspect(conn)
    return column in {col["name"] for col in inspector.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "invoices", COLUMN):
        op.add_column(
            "invoices",
            sa.Column(COLUMN, sa.String(length=200), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "invoices", COLUMN):
        op.drop_column("invoices", COLUMN)
