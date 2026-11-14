"""Attendance policy settings: late threshold + penalty per minute.

Revision ID: a1c3e5f7b2d9
Revises: b2c4d6e8f0a1
Create Date: 2026-11-11

The /attendance page's settings dialog exposed an editable "late threshold"
field, but the backend never read it: `barber_presence.py` hardcoded
`LATE_THRESHOLD_MINUTES = 15` and `PENALTY_PER_LATE_MINUTE = 0.5`, and the
frontend payroll engine independently hardcoded 2 EGP/minute — four times the
backend's rate, on the same screen. Saving the dialog also dropped the value
silently.

These columns move both constants into BusinessSettings so the dialog, the
lateness engine and the payroll maths all read the same numbers. On SQLite the
same columns are also created by `app.db.runtime_schema.ensure_runtime_schema`
(run at every app startup); this migration exists so PostgreSQL deployments
(the dialect where Alembic is the single source of truth) get them too.
"""

from alembic import op
import sqlalchemy as sa

revision = "a1c3e5f7b2d9"
down_revision = "b2c4d6e8f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "business_settings",
        sa.Column(
            "late_threshold_minutes",
            sa.Integer(),
            nullable=False,
            server_default="15",
        ),
    )
    op.add_column(
        "business_settings",
        sa.Column(
            "late_penalty_per_minute",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0.5",
        ),
    )


def downgrade() -> None:
    op.drop_column("business_settings", "late_penalty_per_minute")
    op.drop_column("business_settings", "late_threshold_minutes")
