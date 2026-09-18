"""phase3_totp_2fa_columns

Revision ID: c9d4f2a87b31
Revises: a8e1c4f29b3d
Create Date: 2026-09-18

- New columns users.totp_secret (nullable, set at 2FA setup) and
  users.totp_enabled (default False, flipped on after code verification).
Idempotent: skips columns that already exist.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d4f2a87b31'
down_revision: Union[str, None] = 'a8e1c4f29b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        return any(col["name"] == column for col in insp.get_columns(table))
    except Exception:
        return False


def upgrade() -> None:
    if not _column_exists("users", "totp_secret"):
        op.add_column("users", sa.Column("totp_secret", sa.String(64), nullable=True))
    if not _column_exists("users", "totp_enabled"):
        op.add_column(
            "users",
            sa.Column("totp_enabled", sa.Boolean, nullable=False, server_default="0"),
        )


def downgrade() -> None:
    if _column_exists("users", "totp_enabled"):
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("totp_enabled")
    if _column_exists("users", "totp_secret"):
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("totp_secret")
