"""Backfill product.is_active to match is_archived.

Revision ID: b2c4d6e8f0a1
Revises: a7f3c91d4b62
Create Date: 2026-11-08

The product model historically carried both `is_active` and `is_archived`.
Inventory behavior now treats `is_archived` as the operational archive state
and keeps `is_active` synchronized for backward compatibility. This migration
aligns existing rows once; it is idempotent and safe to re-run.
"""

from alembic import op
import sqlalchemy as sa

revision = "b2c4d6e8f0a1"
down_revision = "a7f3c91d4b62"
branch_labels = None
depends_on = None


def _has_table(bind, name: str) -> bool:
    return name in sa.inspect(bind).get_table_names()


def _has_column(bind, table: str, column: str) -> bool:
    if not _has_table(bind, table):
        return False
    return column in {c["name"] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "products"):
        return
    if not (_has_column(bind, "products", "is_active") and _has_column(bind, "products", "is_archived")):
        return
    op.execute(
        sa.text(
            "UPDATE products SET is_active = CASE WHEN is_archived THEN FALSE ELSE TRUE END "
            "WHERE is_active IS DISTINCT FROM (CASE WHEN is_archived THEN FALSE ELSE TRUE END) "
            "OR is_active IS NULL"
        )
    )


def downgrade() -> None:
    # Data alignment is not safely reversible.
    pass
