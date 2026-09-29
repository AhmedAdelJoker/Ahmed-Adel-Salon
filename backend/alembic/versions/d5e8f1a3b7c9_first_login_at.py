"""Adds `users.first_login_at`, the anchor for the mandatory-2FA grace period.

Revision ID: d5e8f1a3b7c9
Revises: c4d7e9f1a3b5
Create Date: 2026-09-29

Reversible. Downgrade drops the column, which discards the enrolment clock and
resets every account to the `created_at` fallback -- acceptable on rollback,
since the fallback is the conservative one.
"""

from alembic import op
import sqlalchemy as sa

revision = "d5e8f1a3b7c9"
down_revision = "c4d7e9f1a3b5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("first_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Nullable with no default on purpose: the migration must not invent a login
    # timestamp for the 6 rows that already exist, because a fabricated
    # `first_login_at` of "now" would start every existing account's grace period
    # at the moment of the upgrade rather than at the moment of their next real
    # sign-in. The column is filled in by the login endpoint on first use, and
    # the `created_at` fallback covers anyone who has not signed in since.


def downgrade():
    op.drop_column("users", "first_login_at")
