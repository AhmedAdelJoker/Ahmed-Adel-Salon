from alembic import op
import sqlalchemy as sa

revision = "c4d8e1f2a3b4"
down_revision = "7afda716e6ea"
branch_labels = None
depends_on = None


def _table_exists(name):
    return sa.inspect(op.get_bind()).has_table(name)


def _columns(name):
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(name)}


def _create_index(name, table, columns, unique=False):
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}
    if name not in indexes:
        op.create_index(name, table, columns, unique=unique)


def upgrade() -> None:
    if not _table_exists("employees"):
        op.create_table(
            "employees",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("full_name", sa.String(length=255), nullable=False),
            sa.Column("display_name", sa.String(length=255), nullable=True),
            sa.Column("phone_primary", sa.String(length=30), nullable=False),
            sa.Column("phone_secondary", sa.String(length=30), nullable=True),
            sa.Column("profile_image_url", sa.String(length=255), nullable=True),
            sa.Column("national_id", sa.String(length=20), nullable=True),
            sa.Column("birth_date", sa.DateTime(), nullable=True),
            sa.Column("governorate", sa.String(length=100), nullable=True),
            sa.Column("city", sa.String(length=100), nullable=True),
            sa.Column("detailed_address", sa.Text(), nullable=True),
            sa.Column("personal_notes", sa.Text(), nullable=True),
            sa.Column("bio_ar", sa.Text(), nullable=True),
            sa.Column("bio_en", sa.Text(), nullable=True),
            sa.Column("job_title", sa.String(length=50), nullable=False, server_default="barber"),
            sa.Column("department", sa.String(length=100), nullable=True),
            sa.Column("employment_type", sa.String(length=30), nullable=False, server_default="full_time"),
            sa.Column("hire_date", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
            sa.Column("work_days_json", sa.JSON(), nullable=True),
            sa.Column("work_hours_json", sa.JSON(), nullable=True),
            sa.Column("show_in_pos", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("show_in_booking", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("allow_online_booking", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("allow_walk_in_assignment", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("base_salary", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("commission_rate", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0"),
            sa.Column("fixed_bonus", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("default_deductions", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("payment_method", sa.String(length=30), nullable=True),
            sa.Column("wallet_number", sa.String(length=30), nullable=True),
            sa.Column("bank_account", sa.String(length=100), nullable=True),
            sa.Column("assistant_of_barber_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=True),
            sa.Column("assistant_tasks_json", sa.JSON(), nullable=True),
            sa.Column("receives_commission", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("assistant_commission_rate", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0"),
            sa.Column("has_login_account", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index("ix_employees_id", "employees", ["id"])

    if not _table_exists("employee_documents"):
        op.create_table(
            "employee_documents",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("file_url", sa.String(length=255), nullable=False),
            sa.Column("file_type", sa.String(length=50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index("ix_employee_documents_id", "employee_documents", ["id"])

    if not _table_exists("offers"):
        op.create_table(
            "offers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("name_ar", sa.String(length=255), nullable=True),
            sa.Column("name_en", sa.String(length=255), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("description_ar", sa.Text(), nullable=True),
            sa.Column("description_en", sa.Text(), nullable=True),
            sa.Column("image_url", sa.String(length=500), nullable=True),
            sa.Column("original_price", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("offer_price", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("discount_percentage", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index("ix_offers_id", "offers", ["id"])

    if not _table_exists("offer_services"):
        op.create_table(
            "offer_services",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("offer_id", sa.Integer(), sa.ForeignKey("offers.id"), nullable=False),
            sa.Column("service_id", sa.Integer(), sa.ForeignKey("services.id"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index("ix_offer_services_id", "offer_services", ["id"])

    if not _table_exists("offer_products"):
        op.create_table(
            "offer_products",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("offer_id", sa.Integer(), sa.ForeignKey("offers.id"), nullable=False),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
            sa.Column("quantity", sa.Numeric(precision=10, scale=2), nullable=False, server_default="1"),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index("ix_offer_products_id", "offer_products", ["id"])

    if not _table_exists("invoice_adjustment_requests"):
        op.create_table(
            "invoice_adjustment_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
            sa.Column("requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("approved_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("request_type", sa.String(length=50), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("old_values", sa.JSON(), nullable=True),
            sa.Column("requested_values", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index("ix_invoice_adjustment_requests_id", "invoice_adjustment_requests", ["id"])
        _create_index("ix_invoice_adjustment_requests_invoice_id", "invoice_adjustment_requests", ["invoice_id"])
        _create_index("ix_invoice_adjustment_requests_requested_by_user_id", "invoice_adjustment_requests", ["requested_by_user_id"])

    if not _table_exists("activity_logs"):
        op.create_table(
            "activity_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("action", sa.String(length=100), nullable=False),
            sa.Column("entity_type", sa.String(length=100), nullable=False),
            sa.Column("entity_id", sa.Integer(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index("ix_activity_logs_id", "activity_logs", ["id"])
        _create_index("ix_activity_logs_created_at", "activity_logs", ["created_at"])
        _create_index("ix_activity_logs_user_id_created_at", "activity_logs", ["user_id", "created_at"])

    if not _table_exists("payroll_records"):
        op.create_table(
            "payroll_records",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False),
            sa.Column("employee_name_snapshot", sa.String(length=255), nullable=False),
            sa.Column("role_snapshot", sa.String(length=100), nullable=True),
            sa.Column("period_month", sa.Integer(), nullable=False),
            sa.Column("period_year", sa.Integer(), nullable=False),
            sa.Column("base_salary", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("commission_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("bonus_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("deduction_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("advance_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("net_salary", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("payment_method", sa.String(length=50), nullable=True),
            sa.Column("payment_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("expense_id", sa.Integer(), sa.ForeignKey("expenses.id"), nullable=True),
            sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("employee_id", "period_month", "period_year", name="_employee_month_year_uc"),
        )
        _create_index("ix_payroll_records_id", "payroll_records", ["id"])
        _create_index("ix_payroll_records_created_at", "payroll_records", ["created_at"])
        _create_index("ix_payroll_records_status", "payroll_records", ["status"])
        _create_index("ix_payroll_records_employee_id", "payroll_records", ["employee_id"])
        _create_index("ix_payroll_records_user_id", "payroll_records", ["user_id"])
        _create_index("ix_payroll_records_employee_period", "payroll_records", ["employee_id", "period_year", "period_month"])

    column_additions = {
        "cash_transactions": {
            "user_id": sa.Column("user_id", sa.Integer(), nullable=True),
            "customer_id": sa.Column("customer_id", sa.Integer(), nullable=True),
            "employee_id": sa.Column("employee_id", sa.Integer(), nullable=True),
            "voided_by": sa.Column("voided_by", sa.Integer(), nullable=True),
        },
        "expenses": {
            "payment_method": sa.Column("payment_method", sa.String(length=50), nullable=True, server_default="cash"),
            "expense_date": sa.Column("expense_date", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        },
        "products": {
            "is_archived": sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        },
        "customers": {
            "cancellation_count": sa.Column("cancellation_count", sa.Integer(), nullable=True, server_default="0"),
        },
        "appointments": {
            "booking_source": sa.Column("booking_source", sa.String(length=50), nullable=True, server_default=sa.text("'shop'")),
        },
        "invoices": {
            "is_draft": sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        },
    }
    for table_name, additions in column_additions.items():
        existing_columns = _columns(table_name)
        for column_name, column in additions.items():
            if column_name not in existing_columns:
                with op.batch_alter_table(table_name, schema=None) as batch_op:
                    batch_op.add_column(column)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table_name, column_names in {
        "cash_transactions": ["user_id", "customer_id", "employee_id", "voided_by"],
        "expenses": ["payment_method", "expense_date"],
        "products": ["is_archived"],
        "customers": ["cancellation_count"],
        "appointments": ["booking_source"],
        "invoices": ["is_draft"],
    }.items():
        if not inspector.has_table(table_name):
            continue
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name in column_names:
            if column_name in existing_columns:
                with op.batch_alter_table(table_name, schema=None) as batch_op:
                    batch_op.drop_column(column_name)
        inspector = sa.inspect(bind)

    for table_name in [
        "payroll_records",
        "activity_logs",
        "invoice_adjustment_requests",
        "offer_products",
        "offer_services",
        "offers",
        "employee_documents",
        "employees",
    ]:
        if sa.inspect(bind).has_table(table_name):
            op.drop_table(table_name)
