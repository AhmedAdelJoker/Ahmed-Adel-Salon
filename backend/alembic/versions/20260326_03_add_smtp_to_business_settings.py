"""add smtp fields to business_settings

Revision ID: 20260326_03
Revises: 20260326_02
Create Date: 2026-03-26 19:30:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260326_03"
down_revision = "20260326_02"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("business_settings", sa.Column("smtp_host", sa.String(length=255), nullable=True))
    op.add_column("business_settings", sa.Column("smtp_port", sa.Integer(), nullable=False, server_default="587"))
    op.add_column("business_settings", sa.Column("smtp_username", sa.String(length=255), nullable=True))
    op.add_column("business_settings", sa.Column("smtp_password", sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column("business_settings", "smtp_password")
    op.drop_column("business_settings", "smtp_username")
    op.drop_column("business_settings", "smtp_port")
    op.drop_column("business_settings", "smtp_host")