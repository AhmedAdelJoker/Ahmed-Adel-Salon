from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

from app.db.base import Base

revision = "c9fe786b61e8"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None

_TABLES = (
    "audit_logs",
    "report_schedules",
    "seo_pages",
    "shop_settings",
    "attendance_archives",
    "attendance_penalties",
    "employee_presence_logs",
    "employee_time_off",
    "employee_working_hours",
    "leave_requests",
    "customer_cancellation_logs",
    "employee_services",
    "booking_audit_logs",
    "reviews",
    "salary_advances",
    "waitlist_entries",
    "discount_approval_requests",
    "invoice_payments",
    "walk_in_queue",
)


def _has_column(bind, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspect(bind).get_columns(table_name)}


def _has_index(bind, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspect(bind).get_indexes(table_name)}


def _create_index(bind, index_name: str, table_name: str, columns: list[str]) -> None:
    if not _has_index(bind, table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=False)


def _add_column(bind, table_name: str, column: sa.Column) -> None:
    if _has_column(bind, table_name, column.name):
        return
    if column.foreign_keys:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(column)
    else:
        op.add_column(table_name, column)


def _drop_column(bind, table_name: str, column_name: str) -> None:
    if _has_column(bind, table_name, column_name):
        op.drop_column(table_name, column_name)


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in _TABLES:
        table = Base.metadata.tables.get(table_name)
        if table is None:
            raise RuntimeError(f"ORM table is missing: {table_name}")
        table.create(bind=bind, checkfirst=True)

    _add_column(bind, "appointments", sa.Column("cancellation_reason", sa.Text(), nullable=True))
    _add_column(
        bind,
        "cash_transactions",
        sa.Column("balance_after", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    _add_column(
        bind,
        "cash_transactions",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column(
        bind,
        "cash_transactions",
        sa.Column("reference_type", sa.String(length=50), nullable=True),
    )
    _add_column(
        bind,
        "cash_transactions",
        sa.Column("reference_id", sa.Integer(), nullable=True),
    )
    _add_column(
        bind,
        "cash_transactions",
        sa.Column("void_reason", sa.String(length=255), nullable=True),
    )
    _add_column(
        bind,
        "cash_transactions",
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column(bind, "customers", sa.Column("notes", sa.String(length=1000), nullable=True))
    _add_column(
        bind,
        "customers",
        sa.Column(
            "loyalty_points",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    _add_column(
        bind,
        "customers",
        sa.Column(
            "lifetime_spend",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    _add_column(
        bind,
        "customers",
        sa.Column(
            "current_tier",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("'Bronze'"),
        ),
    )
    _add_column(
        bind,
        "business_settings",
        sa.Column("loyalty_settings", sa.JSON(), nullable=True),
    )
    _add_column(
        bind,
        "products",
        sa.Column("company_name", sa.String(length=255), nullable=True),
    )
    _add_column(bind, "expenses", sa.Column("title", sa.String(length=255), nullable=True))
    _add_column(
        bind,
        "customers",
        sa.Column("loyalty_points_earned_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column(bind, "services", sa.Column("name_ar", sa.String(length=255), nullable=True))
    _add_column(bind, "services", sa.Column("name_en", sa.String(length=255), nullable=True))
    _add_column(bind, "services", sa.Column("description_ar", sa.Text(), nullable=True))
    _add_column(bind, "services", sa.Column("description_en", sa.Text(), nullable=True))
    _add_column(bind, "services", sa.Column("image_url", sa.String(length=500), nullable=True))
    _add_column(bind, "services", sa.Column("category", sa.String(length=255), nullable=True))
    _add_column(
        bind,
        "invoices",
        sa.Column(
            "is_closed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    _add_column(
        bind,
        "invoices",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column(
        bind,
        "invoices",
        sa.Column(
            "closed_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", name="fk_invoices_closed_by_user_id_users"),
            nullable=True,
        ),
    )
    _add_column(
        bind,
        "invoices",
        sa.Column("draft_saved_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column(
        bind,
        "business_settings",
        sa.Column(
            "monthly_revenue_target",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
            server_default=sa.text("500000"),
        ),
    )
    _add_column(
        bind,
        "expenses",
        sa.Column("invoice_image_url", sa.String(length=500), nullable=True),
    )
    _add_column(
        bind,
        "expenses",
        sa.Column("reference_type", sa.String(length=50), nullable=True),
    )
    _add_column(bind, "expenses", sa.Column("reference_id", sa.Integer(), nullable=True))
    _add_column(
        bind,
        "expenses",
        sa.Column("internal_notes", sa.String(length=500), nullable=True),
    )
    _add_column(bind, "products", sa.Column("description", sa.Text(), nullable=True))
    _add_column(bind, "products", sa.Column("category", sa.String(length=255), nullable=True))
    _add_column(
        bind,
        "products",
        sa.Column("weight", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    _add_column(bind, "products", sa.Column("image_url", sa.String(length=500), nullable=True))
    _add_column(
        bind,
        "notifications",
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", name="fk_notifications_user_id_users"),
            nullable=True,
        ),
    )

    _create_index(bind, "ix_invoices_is_closed", "invoices", ["is_closed"])
    _create_index(bind, "ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    for index_name, table_name in (
        ("ix_notifications_user_id", "notifications"),
        ("ix_invoices_is_closed", "invoices"),
    ):
        if _has_index(bind, table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    for table_name, column_name in (
        ("notifications", "user_id"),
        ("products", "image_url"),
        ("products", "weight"),
        ("products", "category"),
        ("products", "description"),
        ("expenses", "internal_notes"),
        ("expenses", "reference_id"),
        ("expenses", "reference_type"),
        ("expenses", "invoice_image_url"),
        ("business_settings", "monthly_revenue_target"),
        ("invoices", "draft_saved_at"),
        ("invoices", "closed_by_user_id"),
        ("invoices", "closed_at"),
        ("invoices", "is_closed"),
        ("services", "category"),
        ("services", "image_url"),
        ("services", "description_en"),
        ("services", "description_ar"),
        ("services", "name_en"),
        ("services", "name_ar"),
        ("customers", "loyalty_points_earned_at"),
        ("expenses", "title"),
        ("products", "company_name"),
        ("business_settings", "loyalty_settings"),
        ("customers", "current_tier"),
        ("customers", "lifetime_spend"),
        ("customers", "loyalty_points"),
        ("customers", "notes"),
        ("cash_transactions", "voided_at"),
        ("cash_transactions", "void_reason"),
        ("cash_transactions", "reference_id"),
        ("cash_transactions", "reference_type"),
        ("cash_transactions", "updated_at"),
        ("cash_transactions", "balance_after"),
        ("appointments", "cancellation_reason"),
    ):
        _drop_column(bind, table_name, column_name)

    for table_name in reversed(_TABLES):
        table = Base.metadata.tables.get(table_name)
        if table is not None:
            table.drop(bind=bind, checkfirst=True)
