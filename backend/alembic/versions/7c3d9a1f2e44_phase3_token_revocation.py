"""phase3_token_revocation_denylist

Revision ID: 7c3d9a1f2e44
Revises: 9f2a1c4e7b01
Create Date: 2026-09-17

- New table revoked_tokens (JWT denylist for logout / refresh rotation).
- New column users.token_version (logout-everywhere on password change).
Idempotent: skips objects that already exist.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c3d9a1f2e44'
down_revision: Union[str, None] = '9f2a1c4e7b01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return bind.dialect.has_table(bind, table)


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        return any(col["name"] == column for col in insp.get_columns(table))
    except Exception:
        return False


def upgrade() -> None:
    if not _table_exists("revoked_tokens"):
        op.create_table(
            "revoked_tokens",
            sa.Column("jti", sa.String(64), primary_key=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
            sa.Column("token_type", sa.String(16), nullable=False, server_default="access"),
            sa.Column("reason", sa.String(64), nullable=False, server_default="logout"),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_revoked_tokens_user_id", "revoked_tokens", ["user_id"])
        op.create_index("ix_revoked_tokens_expires_at", "revoked_tokens", ["expires_at"])
    if not _column_exists("users", "token_version"):
        op.add_column(
            "users",
            sa.Column("token_version", sa.Integer, nullable=False, server_default="0"),
        )


def downgrade() -> None:
    if _column_exists("users", "token_version"):
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("token_version")
    if _table_exists("revoked_tokens"):
        op.drop_index("ix_revoked_tokens_expires_at", table_name="revoked_tokens")
        op.drop_index("ix_revoked_tokens_user_id", table_name="revoked_tokens")
        op.drop_table("revoked_tokens")
