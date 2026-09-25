from alembic import op
import sqlalchemy as sa

revision = "a9d1e2f3b4c5"
down_revision = "f2c7a9d4e1b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("invoices"):
        return
    columns = {column["name"] for column in inspector.get_columns("invoices")}
    if "idempotency_key" not in columns:
        with op.batch_alter_table("invoices", schema=None) as batch_op:
            batch_op.add_column(sa.Column("idempotency_key", sa.String(128), nullable=True))
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("invoices")}
    if "request_hash" not in columns:
        with op.batch_alter_table("invoices", schema=None) as batch_op:
            batch_op.add_column(sa.Column("request_hash", sa.String(64), nullable=True))
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("invoices")}
    if "uq_invoices_creator_idempotency_key" not in indexes:
        op.create_index(
            "uq_invoices_creator_idempotency_key",
            "invoices",
            ["created_by_user_id", "idempotency_key"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("invoices"):
        return
    indexes = {index["name"] for index in inspector.get_indexes("invoices")}
    if "uq_invoices_creator_idempotency_key" in indexes:
        op.drop_index(
            "uq_invoices_creator_idempotency_key",
            table_name="invoices",
        )
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("invoices")}
    if "request_hash" in columns:
        with op.batch_alter_table("invoices", schema=None) as batch_op:
            batch_op.drop_column("request_hash")
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("invoices")}
    if "idempotency_key" in columns:
        with op.batch_alter_table("invoices", schema=None) as batch_op:
            batch_op.drop_column("idempotency_key")
