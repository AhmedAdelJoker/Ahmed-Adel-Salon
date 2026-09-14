from sqlalchemy import text

import app.db.base  # noqa: F401
from app.db.base_class import Base
from app.db.session import engine


def _has_column(connection, table_name: str, column_name: str) -> bool:
    try:
        rows = connection.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    except Exception:
        return False
    return any(row[1] == column_name for row in rows)


def _ensure_column(connection, table_name: str, column_name: str, ddl: str) -> None:
    if not _has_column(connection, table_name, column_name):
        connection.execute(text(ddl))


def _ensure_index(connection, index_name: str, ddl: str) -> None:
    try:
        rows = connection.execute(text(f"SELECT name FROM sqlite_master WHERE type='index' AND name='{index_name}'")).fetchall()
        if not rows:
            connection.execute(text(ddl))
    except Exception:
        pass


def ensure_runtime_schema() -> None:
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        _ensure_column(
            connection,
            "services",
            "name_ar",
            "ALTER TABLE services ADD COLUMN name_ar VARCHAR(255)",
        )
        _ensure_column(
            connection,
            "services",
            "name_en",
            "ALTER TABLE services ADD COLUMN name_en VARCHAR(255)",
        )
        _ensure_column(
            connection,
            "services",
            "description_ar",
            "ALTER TABLE services ADD COLUMN description_ar TEXT",
        )
        _ensure_column(
            connection,
            "services",
            "description_en",
            "ALTER TABLE services ADD COLUMN description_en TEXT",
        )
        _ensure_column(
            connection,
            "services",
            "image_url",
            "ALTER TABLE services ADD COLUMN image_url VARCHAR(500)",
        )
        _ensure_column(
            connection,
            "services",
            "category",
            "ALTER TABLE services ADD COLUMN category VARCHAR(255)",
        )
        _ensure_column(
            connection,
            "services",
            "category_id",
            "ALTER TABLE services ADD COLUMN category_id INTEGER",
        )

        _ensure_column(
            connection,
            "products",
            "description",
            "ALTER TABLE products ADD COLUMN description TEXT",
        )
        _ensure_column(
            connection,
            "products",
            "category",
            "ALTER TABLE products ADD COLUMN category VARCHAR(255)",
        )
        _ensure_column(
            connection,
            "products",
            "weight",
            "ALTER TABLE products ADD COLUMN weight NUMERIC(10, 2)",
        )

        _ensure_column(
            connection,
            "invoices",
            "is_closed",
            "ALTER TABLE invoices ADD COLUMN is_closed BOOLEAN DEFAULT 0",
        )
        _ensure_column(
            connection,
            "invoices",
            "closed_at",
            "ALTER TABLE invoices ADD COLUMN closed_at DATETIME",
        )
        _ensure_column(
            connection,
            "invoices",
            "closed_by_user_id",
            "ALTER TABLE invoices ADD COLUMN closed_by_user_id INTEGER",
        )
        _ensure_column(
            connection,
            "invoices",
            "is_draft",
            "ALTER TABLE invoices ADD COLUMN is_draft BOOLEAN DEFAULT 0",
        )
        _ensure_column(
            connection,
            "invoices",
            "draft_saved_at",
            "ALTER TABLE invoices ADD COLUMN draft_saved_at DATETIME",
        )

        # Add user_id to notifications table
        _ensure_column(
            connection,
            "notifications",
            "user_id",
            "ALTER TABLE notifications ADD COLUMN user_id INTEGER",
        )

        _ensure_column(
            connection,
            "employee_presence_logs",
            "is_late",
            "ALTER TABLE employee_presence_logs ADD COLUMN is_late BOOLEAN DEFAULT 0",
        )
        _ensure_column(
            connection,
            "employee_presence_logs",
            "late_reason",
            "ALTER TABLE employee_presence_logs ADD COLUMN late_reason VARCHAR(500)",
        )
        _ensure_column(
            connection,
            "employee_presence_logs",
            "late_minutes",
            "ALTER TABLE employee_presence_logs ADD COLUMN late_minutes INTEGER DEFAULT 0",
        )
        _ensure_column(
            connection,
            "employee_presence_logs",
            "source",
            "ALTER TABLE employee_presence_logs ADD COLUMN source VARCHAR(30) DEFAULT 'manual'",
        )
        _ensure_column(
            connection,
            "products",
            "image_url",
            "ALTER TABLE products ADD COLUMN image_url VARCHAR(500)",
        )
        _ensure_column(
            connection,
            "expenses",
            "invoice_image_url",
            "ALTER TABLE expenses ADD COLUMN invoice_image_url VARCHAR(500)",
        )
        _ensure_column(
            connection,
            "expenses",
            "recipient_name",
            "ALTER TABLE expenses ADD COLUMN recipient_name VARCHAR(255)",
        )
        _ensure_column(
            connection,
            "expenses",
            "reference_type",
            "ALTER TABLE expenses ADD COLUMN reference_type VARCHAR(50)",
        )
        _ensure_column(
            connection,
            "expenses",
            "reference_id",
            "ALTER TABLE expenses ADD COLUMN reference_id INTEGER",
        )
        _ensure_column(
            connection,
            "expenses",
            "internal_notes",
            "ALTER TABLE expenses ADD COLUMN internal_notes VARCHAR(500)",
        )

        _ensure_column(
            connection,
            "business_settings",
            "monthly_revenue_target",
            "ALTER TABLE business_settings ADD COLUMN monthly_revenue_target NUMERIC(12, 2) DEFAULT 500000",
        )
        _ensure_column(
            connection,
            "report_schedules",
            "last_pdf_url",
            "ALTER TABLE report_schedules ADD COLUMN last_pdf_url VARCHAR(500)",
        )

        _ensure_index(connection, "ix_invoices_created_at", "CREATE INDEX ix_invoices_created_at ON invoices (created_at)")
        _ensure_index(connection, "ix_invoices_barber_created", "CREATE INDEX ix_invoices_barber_created ON invoices (barber_id, created_at)")
        _ensure_index(connection, "ix_expenses_expense_date", "CREATE INDEX ix_expenses_expense_date ON expenses (expense_date)")
        _ensure_index(connection, "ix_expenses_created_at", "CREATE INDEX ix_expenses_created_at ON expenses (created_at)")
        _ensure_index(connection, "ix_appointments_date_status_barber", "CREATE INDEX ix_appointments_date_status_barber ON appointments (appointment_date, status, barber_id)")
        _ensure_index(connection, "ix_customers_is_deleted", "CREATE INDEX ix_customers_is_deleted ON customers (is_deleted)")
        _ensure_index(connection, "ix_invoice_items_invoice_id", "CREATE INDEX ix_invoice_items_invoice_id ON invoice_items (invoice_id)")
        _ensure_index(connection, "ix_cash_transactions_date", "CREATE INDEX ix_cash_transactions_date ON cash_transactions (transaction_date)")

        # Create new tables for attendance archives and penalties
        from app.models.employee_presence_log import AttendanceArchive, AttendancePenalty
        AttendanceArchive.__table__.create(connection, checkfirst=True)
        AttendancePenalty.__table__.create(connection, checkfirst=True)

        connection.execute(
            text("UPDATE products SET unit = 'g' WHERE unit IS NULL OR unit = '' OR unit = 'pcs'")
        )
        connection.execute(
            text("UPDATE services SET category = 'عام' WHERE category IS NULL OR TRIM(category) = ''")
        )
