"""add_month_closures

Revision ID: b3c8d1e5f7a2
Revises: 9c4a7b2d6e18
Create Date: 2026-10-21 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3c8d1e5f7a2"
down_revision: Union[str, None] = "9c4a7b2d6e18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # `ensure_runtime_schema()` runs `create_all` at startup, so a database
    # that already booted the new code has the table before Alembic reaches
    # this revision. Creating it again would abort the whole upgrade.
    if sa.inspect(op.get_bind()).has_table("month_closures"):
        return

    op.create_table(
        "month_closures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("invoice_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["closed_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year", "month", name="uq_month_closures_year_month"),
    )
    op.create_index("ix_month_closures_id", "month_closures", ["id"], unique=False)
    op.create_index("ix_month_closures_year", "month_closures", ["year"], unique=False)
    op.create_index("ix_month_closures_month", "month_closures", ["month"], unique=False)


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("month_closures"):
        return
    op.drop_index("ix_month_closures_month", table_name="month_closures")
    op.drop_index("ix_month_closures_year", table_name="month_closures")
    op.drop_index("ix_month_closures_id", table_name="month_closures")
    op.drop_table("month_closures")
