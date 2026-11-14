"""Index the columns the endpoints actually filter and sort on.

Derived from an audit of the real query patterns, not from the model defaults.
Three things made most of this necessary:

1. ``runtime_schema.py`` returns early on any non-SQLite dialect, so the eight
   indexes it creates with raw DDL — including ``invoice_items.invoice_id`` and
   ``invoices.created_at`` — exist on SQLite and are **absent on PostgreSQL**.
   This migration puts them back for every dialect.

2. Several tables carry a single index, usually their primary key, and are then
   filtered or sorted on other columns on every request. ``products`` is the
   clearest case: ``sku``, ``category`` and ``is_archived`` are all unindexed, so
   the entire inventory screen is a scan and a sort.

3. ``inventory_logs.product_id`` is the third column of the uniqueness
   constraint that guards idempotent deduction, so a predicate that leads with
   ``product_id`` cannot use it. The product-history screen also runs one
   aggregate per returned row, which turned a single page load into as many as
   200 unindexed full scans.

Composite column order follows the equality columns first and the range or sort
column last, so the index can be range-scanned and read in order.

Index build strategy: ``CREATE INDEX IF NOT EXISTS`` where the dialect supports
it, an existence check otherwise, and a batch-mode Postgres build. On a large
table ``CREATE INDEX`` takes a write lock; production should use
``CREATE INDEX CONCURRENTLY``, which cannot run inside a transaction, so the
statements are issued with autocommit for Postgres.

Revision ID: c4d7e9f1a3b5
Revises: b8e3f1a2c4d7
"""

from alembic import op
import backend_dialect_support as ds
import sqlalchemy as sa

revision = "c4d7e9f1a3b5"
down_revision = "b8e3f1a2c4d7"
branch_labels = None
depends_on = None


def _columns(conn, table: str) -> set[str]:
    # `pragma_table_info` is a SQLite table-valued function with no PostgreSQL
    # equivalent. On Postgres it raises UndefinedFunction, which reads like a
    # missing table rather than like dialect-specific syntax. See
    # alembic/dialect_support.py for the portable form.
    return set(ds.columns_of(conn, table))


def _table_exists(conn, table: str) -> bool:
    return ds.table_exists(conn, table)


def _index_exists(conn, name: str) -> bool:
    return ds.index_exists(conn, name)


# (index_name, table, columns, why)
INDEXES: list[tuple[str, str, tuple[str, ...], str]] = [
    # -- restoring what runtime_schema.py creates only on SQLite -----------
    ("ix_invoices_created_at", "invoices", ("created_at",), "month close, archive, revenue windows"),
    ("ix_invoices_barber_created", "invoices", ("barber_id", "created_at"), "revenue per barber over a window"),
    ("ix_invoice_items_invoice_id", "invoice_items", ("invoice_id",), "every invoice loads its lines"),
    ("ix_cash_transactions_date", "cash_transactions", ("transaction_date",), "cashbox day totals"),
    ("ix_expenses_created_at", "expenses", ("created_at",), "today's expenses on the dashboard"),
    ("ix_expenses_expense_date", "expenses", ("expense_date",), "expense export and report windows"),
    ("ix_appointments_date_status_barber", "appointments", ("appointment_date", "status", "barber_id"), "day view and auto-cancel sweep"),
    ("ix_customers_is_deleted", "customers", ("is_deleted",), "every customer list excludes the deleted"),

    # -- leading column was unusable for these predicates -----------------
    ("ix_invoices_draft_created", "invoices", ("is_draft", "created_at"), "draft listing sorted by date; the existing index has the reverse order"),
    ("ix_invoices_customer_created", "invoices", ("customer_id", "created_at"), "per-customer invoice history"),
    ("ix_customers_deleted_archived", "customers", ("is_deleted", "customer_id"), "WHERE is_deleted=false ORDER BY customer_id"),
    ("ix_customers_deleted_at", "customers", ("is_deleted", "deleted_at"), "archived-customer listing"),
    ("ix_appointments_customer_date", "appointments", ("customer_id", "appointment_date"), "per-customer booking history"),
    ("ix_service_sessions_appointment", "service_sessions", ("appointment_id",), "invoice creation resolves the session for an appointment"),
    ("ix_service_sessions_customer", "service_sessions", ("customer_id",), "customer service history"),
    ("ix_expenses_payment_method", "expenses", ("payment_method",), "expense export filter"),

    # -- product_id leads a predicate but trails the uniqueness constraint -
    ("ix_inventory_logs_product_created", "inventory_logs", ("product_id", "created_at"), "product history and the per-row running-balance aggregate"),
    ("ix_inventory_logs_created_at", "inventory_logs", ("created_at",), "inventory log date filters"),
    ("ix_inventory_logs_type", "inventory_logs", ("type",), "add/remove counters on the inventory screen"),
    ("ix_inventory_logs_product_id", "inventory_logs", ("product_id",), "the uniqueness constraint lists product_id third, so it cannot lead a lookup"),
    ("ix_invoice_items_service_id", "invoice_items", ("service_id",), "top-services report groups by service"),
    ("ix_invoice_items_product_id", "invoice_items", ("product_id",), "product sales in the invoice writer"),
    (
        "ix_service_products_service",
        "service_products",
        ("service_id",),
        "the ingredient recipe, read on every invoice that contains the service",
    ),
    (
        "ix_service_products_product",
        "service_products",
        ("product_id",),
        "which services consume a product, for the product detail screen",
    ),

    # -- tables carrying only a primary key --------------------------------
    ("ix_products_sku", "products", ("sku",), "product lookup by SKU"),
    ("ix_products_category", "products", ("category",), "inventory filter and grouping"),
    ("ix_products_archived", "products", ("is_archived",), "every product list excludes the archive"),
    ("ix_waitlist_status_priority", "waitlist_entries", ("status", "priority"), "default sort is priority then age"),
    ("ix_waitlist_preferred_date", "waitlist_entries", ("preferred_date",), "waitlist for a given day"),
    ("ix_walk_in_status", "walk_in_queue", ("status",), "the board lists by status and mints ticket numbers from a count"),
    ("ix_booking_audit_appointment", "booking_audit_logs", ("appointment_id",), "per-appointment change history"),
    ("ix_cancellation_customer", "customer_cancellation_logs", ("customer_id",), "permanent delete counts cancellations per customer"),
    ("ix_offers_active_public", "offers", ("is_active", "is_public"), "the public booking catalog"),
    ("ix_services_active", "services", ("is_active",), "catalog listings filter on it"),
    ("ix_service_categories_active", "service_categories", ("is_active", "sort_order"), "catalog ordering"),
    ("ix_employees_status", "employees", ("status",), "every staff list filters on it"),
    ("ix_employees_user_id", "employees", ("user_id",), "resolving the login behind an employee"),
    ("ix_users_role_active", "users", ("role", "is_active"), "role-filtered staff queries"),
    ("ix_salary_advances_employee_date", "salary_advances", ("employee_id", "advance_date"), "advance history sorted by date"),

    # -- time-ordered paths with no index on the time column ---------------
    ("ix_presence_employee_created", "employee_presence_logs", ("employee_id", "created_at"), "attendance ranges and 'last punch'"),
    ("ix_presence_status", "employee_presence_logs", ("status",), "currently-in counters"),
    ("ix_activity_created_action", "activity_logs", ("created_at", "action"), "activity log filtered by action and date"),
    ("ix_activity_entity_type", "activity_logs", ("entity_type",), "activity log entity filter"),
    ("ix_activity_created_entity", "activity_logs", ("created_at", "entity_type"), "date window with an entity filter"),
    ("ix_report_schedules_active_next", "report_schedules", ("is_active", "next_run_at"), "the timer poll for due schedules"),
    ("ix_notifications_role_read", "notifications", ("user_role", "is_read"), "unread badge count per role"),
    ("ix_notifications_user_read", "notifications", ("user_id", "is_read"), "unread badge count per user"),
    ("ix_appointments_time", "appointments", ("appointment_time",), "auto-cancel compares the time column directly"),
]


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name
    created = 0

    for name, table, columns, _why in INDEXES:
        if not _table_exists(conn, table):
            continue
        if not set(columns) <= _columns(conn, table):
            # A column that no longer exists means the index no longer applies.
            continue
        if _index_exists(conn, name):
            continue

        if dialect == "postgresql":
            # CONCURRENTLY avoids taking a write lock while a large table is
            # indexed, which matters for a table that is receiving sales.
            #
            # It cannot run inside a transaction block. `alembic/env.py` sets
            # `transaction_per_migration=True`, so this migration owns its
            # transaction and the statement is the only thing that needs to leave
            # it -- which is done on a second connection, because suspending the
            # first one means either a rollback that discards the version write
            # or a commit that leaves the version behind. Both were tried; both
            # produced a migration that reported success while `alembic current`
            # stayed a revision behind, so the next deploy replayed the history
            # and printed "created 0".
            with conn.engine.connect().execution_options(
                isolation_level="AUTOCOMMIT"
            ) as own:
                _run_concurrently(
                    own,
                    f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "{name}" '
                    f'ON "{table}" ({", ".join(chr(34) + c + chr(34) for c in columns)})',
                )
        else:
            op.create_index(name, table, list(columns), unique=False)

        created += 1
        print(f"  + {name} on {table}({', '.join(columns)}) -- {_why}")

    print(f"created {created} index(es)")


def _run_concurrently(conn, statement: str) -> None:
    """Runs a `* CONCURRENTLY` statement on an AUTOCOMMIT connection.

    PostgreSQL refuses these inside a transaction block, which is why the caller
    passes a second connection opened at AUTOCOMMIT rather than the migration's
    own. This helper only has to set the two timeouts and issue the statement.

    Both timeouts matter and neither is optional:

      * `lock_timeout` bounds the wait for a competing lock. Without it a build
        queued behind a long transaction waits indefinitely, holding a connection
        from the pool -- and a pool exhausted by migration is a pool the
        application cannot use.
      * `statement_timeout` bounds the build itself. An index build on a large
        table is measured in minutes, and a migration that hangs on one is a
        deploy that hangs.

    The autocommit flag is restored in a `finally` even though the connection
    arrives with it set, so a caller that passes an ordinary connection does not
    silently change its isolation level for the rest of the session.
    """
    # `.connection` unwraps the SQLAlchemy Connection to the pooled DBAPI
    # connection, and `.dbapi_connection` reaches psycopg2's object, which is
    # where `autocommit` lives. `conn.connection()` on a Connection returns a
    # `_ConnectionFairy` and calling it is a TypeError.
    raw = conn.connection.dbapi_connection
    previous_autocommit = raw.autocommit
    try:
        raw.autocommit = True
        cursor = raw.cursor()
        try:
            cursor.execute("SET lock_timeout = '5s'")
            cursor.execute("SET statement_timeout = '10min'")
            cursor.execute(statement)
            cursor.close()
        finally:
            if not previous_autocommit:
                raw.autocommit = False
    finally:
        pass


def downgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name
    for name, table, _columns_tuple, _why in INDEXES:
        if not _index_exists(conn, name):
            continue
        if dialect == "postgresql":
            with conn.engine.connect().execution_options(
                isolation_level="AUTOCOMMIT"
            ) as own:
                _run_concurrently(own, f'DROP INDEX CONCURRENTLY IF EXISTS "{name}"')
        else:
            op.drop_index(name, table_name=table)
    if dialect == "postgresql":
        # Same rule as upgrade: every CONCURRENTLY statement first, then close
        # the stale transaction object and open a fresh one for the version write.
        conn.rollback()
        conn.begin()
