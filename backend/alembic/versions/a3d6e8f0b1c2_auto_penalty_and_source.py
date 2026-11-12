"""Auto-penalty switch + penalty source column.

Revision ID: a3d6e8f0b1c2
Revises: a1c3e5f7b2d9
Create Date: 2026-11-12

Two operational changes to the penalties feature:

* `attendance_penalties.source` distinguishes penalties written by the punch
  engine ("auto") from the ones entered by an admin in the penalties tab
  ("manual"). Without it the UI cannot label them, and an admin cannot tell
  whether a deduction was automatic or a deliberate disciplinary action.
* `business_settings.auto_penalty_enabled` is a master switch for automatic
  late-arrival penalties. The punch engine still records is_late/late_minutes
  when it is off — it just skips the AttendancePenalty row, for salons that
  track lateness without deducting.

On SQLite the same columns are created by ensure_runtime_schema at startup;
this migration exists so PostgreSQL deployments (Alembic's territory) get them.
"""

from alembic import op
import sqlalchemy as sa

revision = "a3d6e8f0b1c2"
down_revision = "a1c3e5f7b2d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "attendance_penalties",
        sa.Column("source", sa.String(20), nullable=False, server_default="auto"),
    )
    op.add_column(
        "business_settings",
        sa.Column("auto_penalty_enabled", sa.Boolean(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("business_settings", "auto_penalty_enabled")
    op.drop_column("attendance_penalties", "source")
