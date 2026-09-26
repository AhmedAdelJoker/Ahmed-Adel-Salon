"""Move member credentials to member_accounts and add settings concurrency.

Three changes:

1. ``member_accounts`` — the public-booking password hash and token version move
   off ``customers``. The data is copied across first, so no member is logged out.
2. ``business_settings.version`` — optimistic concurrency. Two owners saving the
   settings page at the same time used to silently last-write-wins; the second
   save is now rejected with 409 unless the client sends the version it read.
3. ``business_settings.public_site_published_version`` — records which version
   the published snapshot was taken from, so the UI can tell the owner their
   public site is stale instead of serving old hours with no warning.

Revision ID: a7b2c3d4e5f6
Revises: f4a1c7e29b03
"""

from alembic import op
import sqlalchemy as sa

revision = "a7b2c3d4e5f6"
down_revision = "f4a1c7e29b03"
branch_labels = None
depends_on = None

MEMBER_COLUMNS = ("member_password_hash", "member_token_version")


def _columns(conn, table: str) -> set[str]:
    rows = conn.execute(
        sa.text(f"SELECT name FROM pragma_table_info('{table}')")
    ).fetchall()
    return {r[0] for r in rows}


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"),
        {"t": table},
    ).first()
    return row is not None


def upgrade() -> None:
    conn = op.get_bind()
    inspector_has_customers = _table_exists(conn, "customers")
    customer_columns = _columns(conn, "customers") if inspector_has_customers else set()

    if not _table_exists(conn, "member_accounts"):
        op.create_table(
            "member_accounts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("customer_id", sa.Integer(), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column(
                "token_version",
                sa.Integer(),
                server_default="0",
                nullable=False,
            ),
            sa.Column("is_active", sa.Boolean(), server_default="1", nullable=False),
            sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("customer_id", name="uq_member_accounts_customer_id"),
        )
        op.create_index(
            op.f("ix_member_accounts_id"), "member_accounts", ["id"], unique=False
        )
        op.create_index(
            op.f("ix_member_accounts_customer_id"),
            "member_accounts",
            ["customer_id"],
            unique=False,
        )

    # Carry existing credentials across, then drop the customer columns.
    if inspector_has_customers and "member_password_hash" in customer_columns:
        has_token_version = "member_token_version" in customer_columns
        token_expr = (
            "COALESCE(member_token_version, 0)"
            if has_token_version
            else "0"
        )
        op.execute(
            sa.text(
                f"""
                INSERT OR IGNORE INTO member_accounts
                    (customer_id, password_hash, token_version, is_active)
                SELECT customer_id,
                       member_password_hash,
                       {token_expr},
                       1
                FROM customers
                WHERE member_password_hash IS NOT NULL
                  AND member_password_hash != ''
                """
            )
        )
        with op.batch_alter_table("customers") as batch_op:
            batch_op.drop_column("member_password_hash")
            if has_token_version:
                batch_op.drop_column("member_token_version")

    settings_columns = _columns(conn, "business_settings")
    if _table_exists(conn, "business_settings"):
        if "version" not in settings_columns:
            op.add_column(
                "business_settings",
                sa.Column(
                    "version",
                    sa.Integer(),
                    server_default="1",
                    nullable=False,
                ),
            )
            op.execute(
                sa.text("UPDATE business_settings SET version = 1 WHERE version IS NULL")
            )
        if "public_site_published_version" not in settings_columns:
            op.add_column(
                "business_settings",
                sa.Column("public_site_published_version", sa.Integer(), nullable=True),
            )


def downgrade() -> None:
    conn = op.get_bind()
    customer_columns = _columns(conn, "customers") if _table_exists(conn, "customers") else set()

    if _table_exists(conn, "business_settings"):
        settings_columns = _columns(conn, "business_settings")
        if "public_site_published_version" in settings_columns:
            op.drop_column("business_settings", "public_site_published_version")
        if "version" in settings_columns:
            op.drop_column("business_settings", "version")

    if "member_password_hash" not in customer_columns:
        with op.batch_alter_table("customers") as batch_op:
            batch_op.add_column(
                sa.Column("member_password_hash", sa.String(length=255), nullable=True)
            )
            batch_op.add_column(
                sa.Column(
                    "member_token_version",
                    sa.Integer(),
                    server_default="0",
                    nullable=False,
                )
            )
        op.execute(
            sa.text(
                """
                UPDATE customers
                SET member_password_hash = (
                        SELECT m.password_hash FROM member_accounts m
                        WHERE m.customer_id = customers.customer_id
                    ),
                    member_token_version = COALESCE((
                        SELECT m.token_version FROM member_accounts m
                        WHERE m.customer_id = customers.customer_id
                    ), 0)
                """
            )
        )

    if _table_exists(conn, "member_accounts"):
        op.drop_table("member_accounts")
