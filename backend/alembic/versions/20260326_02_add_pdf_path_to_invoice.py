"""add pdf_path to invoices

Revision ID: 20260326_02
Revises: 20260326_01
Create Date: 2026-03-26 18:30:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260326_02"
down_revision = "20260326_01"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("invoices", sa.Column("pdf_path", sa.String(length=500), nullable=True))


def downgrade():
    op.drop_column("invoices", "pdf_path")