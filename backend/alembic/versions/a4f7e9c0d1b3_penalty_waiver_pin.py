"""PIN-gated, irreversible penalty waivers + month-closure lock.

Revision ID: a4f7e9c0d1b3
Revises: a3d6e8f0b1c2
Create Date: 2026-11-12

Two salon-control features for the penalties tab:

* `business_settings.penalty_cancel_pin_hash` — a 4-digit PIN required to
  excuse a penalty. The PIN is hashed like a password and never returned by
  any endpoint; when unset, waivers are refused outright.
* Waivers become irreversible: this migration exists to mark that change,
  though the columns/tables themselves are unchanged — the month lock reuses
  the existing `month_closures` archive locks rather than a new table, so a
  closed month freezes penalty creation, waiver and auto-penalty generation
  with zero schema drift.
"""

from alembic import op
import sqlalchemy as sa

revision = "a4f7e9c0d1b3"
down_revision = "a3d6e8f0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "business_settings",
        sa.Column("penalty_cancel_pin_hash", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("business_settings", "penalty_cancel_pin_hash")
