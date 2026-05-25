"""add appointments, roles, notifications, business settings

Revision ID: 20260326_01
Revises: 
Create Date: 2026-03-26 17:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20260326_01"
down_revision = None
branch_labels = None
depends_on = None


def column_exists(inspector, table_name, column_name):
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def table_exists(inspector, table_name):
    return table_name in inspector.get_table_names()


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    # -----------------------------------
    # users table adjustments
    # -----------------------------------
    if table_exists(inspector, "users"):
        if not column_exists(inspector, "users", "role"):
            op.add_column(
                "users",
                sa.Column("role", sa.String(length=30), nullable=False, server_default="cashier"),
            )

        if not column_exists(inspector, "users", "barber_id"):
            op.add_column(
                "users",
                sa.Column("barber_id", sa.Integer(), nullable=True),
            )
            op.create_foreign_key(
                "fk_users_barber_id_barbers",
                "users",
                "barbers",
                ["barber_id"],
                ["id"],
            )

    # -----------------------------------
    # services table adjustments
    # -----------------------------------
    if table_exists(inspector, "services"):
        if not column_exists(inspector, "services", "duration_minutes"):
            op.add_column(
                "services",
                sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="30"),
            )

    # -----------------------------------
    # business_settings
    # -----------------------------------
    if not table_exists(inspector, "business_settings"):
        op.create_table(
            "business_settings",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("salon_name", sa.String(length=255), nullable=False, server_default="Salon Management Pro"),
            sa.Column("shop_whatsapp", sa.String(length=30), nullable=True),
            sa.Column("whatsapp_sender_phone", sa.String(length=50), nullable=True),
            sa.Column("default_language", sa.String(length=10), nullable=False, server_default="ar"),
            sa.Column("default_theme", sa.String(length=10), nullable=False, server_default="dark"),
            sa.Column("notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("default_notification_channel", sa.String(length=20), nullable=False, server_default="whatsapp"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        )

    # -----------------------------------
    # appointments
    # -----------------------------------
    if not table_exists(inspector, "appointments"):
        op.create_table(
            "appointments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("customer_id", sa.Integer(), nullable=False),
            sa.Column("barber_id", sa.Integer(), nullable=False),
            sa.Column("appointment_date", sa.Date(), nullable=False),
            sa.Column("appointment_time", sa.Time(), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("total_estimated_price", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("total_estimated_duration_minutes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("confirmation_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("reminder_24h_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("reminder_2h_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("converted_to_session", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("session_id", sa.Integer(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["customer_id"], ["customers.customer_id"]),
            sa.ForeignKeyConstraint(["barber_id"], ["barbers.id"]),
            sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        )
        op.create_index("ix_appointments_id", "appointments", ["id"])
        op.create_index("ix_appointments_customer_id", "appointments", ["customer_id"])
        op.create_index("ix_appointments_barber_id", "appointments", ["barber_id"])
        op.create_index("ix_appointments_status", "appointments", ["status"])

    # -----------------------------------
    # appointment_services
    # -----------------------------------
    if not table_exists(inspector, "appointment_services"):
        op.create_table(
            "appointment_services",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("appointment_id", sa.Integer(), nullable=False),
            sa.Column("service_id", sa.Integer(), nullable=True),
            sa.Column("service_name_snapshot", sa.String(length=255), nullable=False),
            sa.Column("price_snapshot", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("duration_snapshot_minutes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("is_changed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("change_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["service_id"], ["services.id"]),
        )
        op.create_index("ix_appointment_services_id", "appointment_services", ["id"])
        op.create_index("ix_appointment_services_appointment_id", "appointment_services", ["appointment_id"])

    # -----------------------------------
    # invoices adjustments
    # -----------------------------------
    if table_exists(inspector, "invoices"):
        if not column_exists(inspector, "invoices", "appointment_id"):
            op.add_column("invoices", sa.Column("appointment_id", sa.Integer(), nullable=True))
            op.create_foreign_key(
                "fk_invoices_appointment_id_appointments",
                "invoices",
                "appointments",
                ["appointment_id"],
                ["id"],
            )

        if not column_exists(inspector, "invoices", "created_by_user_id"):
            op.add_column("invoices", sa.Column("created_by_user_id", sa.Integer(), nullable=True))
            op.create_foreign_key(
                "fk_invoices_created_by_user_id_users",
                "invoices",
                "users",
                ["created_by_user_id"],
                ["id"],
            )

    # -----------------------------------
    # invoice_items
    # -----------------------------------
    if not table_exists(inspector, "invoice_items"):
        op.create_table(
            "invoice_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("invoice_id", sa.Integer(), nullable=False),
            sa.Column("service_id", sa.Integer(), nullable=True),
            sa.Column("service_name", sa.String(length=255), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("total_price", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
            sa.ForeignKeyConstraint(["service_id"], ["services.id"]),
        )
        op.create_index("ix_invoice_items_id", "invoice_items", ["id"])

    # -----------------------------------
    # activity_logs
    # -----------------------------------
    if not table_exists(inspector, "activity_logs"):
        op.create_table(
            "activity_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("action", sa.String(length=100), nullable=False),
            sa.Column("entity_type", sa.String(length=100), nullable=False),
            sa.Column("entity_id", sa.Integer(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        )
        op.create_index("ix_activity_logs_id", "activity_logs", ["id"])

    # -----------------------------------
    # notification_logs
    # -----------------------------------
    if not table_exists(inspector, "notification_logs"):
        op.create_table(
            "notification_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("appointment_id", sa.Integer(), nullable=True),
            sa.Column("invoice_id", sa.Integer(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("channel", sa.String(length=20), nullable=False),
            sa.Column("message_type", sa.String(length=50), nullable=False),
            sa.Column("recipient_phone", sa.String(length=30), nullable=False),
            sa.Column("provider_name", sa.String(length=50), nullable=True),
            sa.Column("provider_message_id", sa.String(length=255), nullable=True),
            sa.Column("payload", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
            sa.Column("failure_reason", sa.Text(), nullable=True),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"]),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
            sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        )
        op.create_index("ix_notification_logs_id", "notification_logs", ["id"])


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if table_exists(inspector, "notification_logs"):
        op.drop_table("notification_logs")

    if table_exists(inspector, "activity_logs"):
        op.drop_table("activity_logs")

    if table_exists(inspector, "invoice_items"):
        op.drop_table("invoice_items")

    if table_exists(inspector, "appointment_services"):
        op.drop_table("appointment_services")

    if table_exists(inspector, "appointments"):
        op.drop_table("appointments")

    if table_exists(inspector, "business_settings"):
        op.drop_table("business_settings")

    if table_exists(inspector, "invoices"):
        if column_exists(inspector, "invoices", "created_by_user_id"):
            op.drop_constraint("fk_invoices_created_by_user_id_users", "invoices", type_="foreignkey")
            op.drop_column("invoices", "created_by_user_id")

        if column_exists(inspector, "invoices", "appointment_id"):
            op.drop_constraint("fk_invoices_appointment_id_appointments", "invoices", type_="foreignkey")
            op.drop_column("invoices", "appointment_id")

    if table_exists(inspector, "services"):
        if column_exists(inspector, "services", "duration_minutes"):
            op.drop_column("services", "duration_minutes")

    if table_exists(inspector, "users"):
        if column_exists(inspector, "users", "barber_id"):
            op.drop_constraint("fk_users_barber_id_barbers", "users", type_="foreignkey")
            op.drop_column("users", "barber_id")

        if column_exists(inspector, "users", "role"):
            op.drop_column("users", "role")