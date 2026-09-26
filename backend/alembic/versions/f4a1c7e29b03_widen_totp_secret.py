"""Widen users.totp_secret for Fernet ciphertext.

The column was String(64), sized for a raw base32 seed. Now that TOTP seeds are
encrypted at rest (app/core/totp_crypto.py) a Fernet token needs ~100
characters, so the column has to grow. Existing plaintext seeds are left as-is;
they are transparently re-encrypted the first time their owner verifies a code.

Revision ID: f4a1c7e29b03
Revises: c9fe786b61e8
"""

from alembic import op
import sqlalchemy as sa

revision = "f4a1c7e29b03"
down_revision = "c9fe786b61e8"
branch_labels = None
depends_on = None


def _current_type(conn) -> str:
    return str(
        conn.execute(
            sa.text(
                "SELECT type FROM pragma_table_info('users') "
                "WHERE name = 'totp_secret'"
            )
        ).scalar()
        or ""
    ).upper()


def upgrade() -> None:
    conn = op.get_bind()
    if "VARCHAR" not in _current_type(conn):
        # Column absent (fresh DB built straight from metadata) — nothing to do.
        return
    # SQLite ignores VARCHAR lengths and batch mode rebuilds the table, so this
    # is a no-op in practice there but keeps other backends honest.
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "totp_secret",
            existing_type=sa.String(length=64),
            type_=sa.String(length=255),
            existing_nullable=True,
        )


def downgrade() -> None:
    conn = op.get_bind()
    if "VARCHAR" not in _current_type(conn):
        return
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "totp_secret",
            existing_type=sa.String(length=255),
            type_=sa.String(length=64),
            existing_nullable=True,
        )
