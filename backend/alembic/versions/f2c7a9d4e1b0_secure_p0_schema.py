from alembic import op
import sqlalchemy as sa

revision = "f2c7a9d4e1b0"
down_revision = "b7e2f1a9c4d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    invoice_columns = {
        column["name"] for column in inspector.get_columns("invoice_adjustment_requests")
    }
    if "decision_note" not in invoice_columns:
        with op.batch_alter_table("invoice_adjustment_requests") as batch_op:
            batch_op.add_column(sa.Column("decision_note", sa.Text(), nullable=True))

    inspector = sa.inspect(bind)
    invoice_item_columns = {
        column["name"] for column in inspector.get_columns("invoice_items")
    }
    if "offer_id" not in invoice_item_columns:
        with op.batch_alter_table("invoice_items") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "offer_id",
                    sa.Integer(),
                    sa.ForeignKey("offers.id", name="fk_invoice_items_offer_id"),
                    nullable=True,
                )
            )
    invoice_item_indexes = {
        index["name"] for index in inspector.get_indexes("invoice_items")
    }
    if "ix_invoice_items_offer_id" not in invoice_item_indexes:
        op.create_index(
            "ix_invoice_items_offer_id",
            "invoice_items",
            ["offer_id"],
            unique=False,
        )

    inspector = sa.inspect(bind)
    document_columns = {
        column["name"] for column in inspector.get_columns("employee_documents")
    }
    if "storage_key" not in document_columns:
        with op.batch_alter_table("employee_documents") as batch_op:
            batch_op.add_column(sa.Column("storage_key", sa.String(255), nullable=True))

    inspector = sa.inspect(bind)
    document_indexes = {
        index["name"] for index in inspector.get_indexes("employee_documents")
    }
    if "ix_employee_documents_storage_key" not in document_indexes:
        op.create_index(
            "ix_employee_documents_storage_key",
            "employee_documents",
            ["storage_key"],
            unique=True,
        )

    inspector = sa.inspect(bind)
    if inspector.has_table("business_settings"):
        business_settings_columns = {
            column["name"]
            for column in inspector.get_columns("business_settings")
        }
        if "manager_approval_pin" in business_settings_columns:
            with op.batch_alter_table("business_settings") as batch_op:
                batch_op.drop_column("manager_approval_pin")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("business_settings"):
        business_settings_columns = {
            column["name"]
            for column in inspector.get_columns("business_settings")
        }
        if "manager_approval_pin" not in business_settings_columns:
            with op.batch_alter_table("business_settings") as batch_op:
                batch_op.add_column(
                    sa.Column("manager_approval_pin", sa.String(20), nullable=True)
                )

    inspector = sa.inspect(bind)
    document_indexes = {
        index["name"] for index in inspector.get_indexes("employee_documents")
    }
    if "ix_employee_documents_storage_key" in document_indexes:
        op.drop_index(
            "ix_employee_documents_storage_key",
            table_name="employee_documents",
        )

    inspector = sa.inspect(bind)
    document_columns = {
        column["name"] for column in inspector.get_columns("employee_documents")
    }
    if "storage_key" in document_columns:
        with op.batch_alter_table("employee_documents") as batch_op:
            batch_op.drop_column("storage_key")

    inspector = sa.inspect(bind)
    invoice_item_indexes = {
        index["name"] for index in inspector.get_indexes("invoice_items")
    }
    if "ix_invoice_items_offer_id" in invoice_item_indexes:
        op.drop_index(
            "ix_invoice_items_offer_id",
            table_name="invoice_items",
        )

    inspector = sa.inspect(bind)
    invoice_item_columns = {
        column["name"] for column in inspector.get_columns("invoice_items")
    }
    if "offer_id" in invoice_item_columns:
        with op.batch_alter_table("invoice_items") as batch_op:
            batch_op.drop_column("offer_id")

    inspector = sa.inspect(bind)
    invoice_columns = {
        column["name"] for column in inspector.get_columns("invoice_adjustment_requests")
    }
    if "decision_note" in invoice_columns:
        with op.batch_alter_table("invoice_adjustment_requests") as batch_op:
            batch_op.drop_column("decision_note")
