import re

from alembic import op
import sqlalchemy as sa

revision = "c5d6e7f8a9b0"
down_revision = "b8e2f3a4c5d6"
branch_labels = None
depends_on = None


def _table_sql(bind, table_name):
    row = bind.exec_driver_sql(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table_name,)
    ).fetchone()
    return row[0] if row else None


def _rebuild_without_legacy_fk(bind, table_name):
    create_sql = _table_sql(bind, table_name)
    if create_sql is None:
        return
    index_rows = bind.exec_driver_sql(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL",
        (table_name,),
    ).fetchall()
    modified_sql = re.sub(
        r",\s*FOREIGN KEY\s*\(\s*barber_id\s*\)\s+REFERENCES\s+barbers\s*\(\s*id\s*\)",
        "",
        create_sql,
        flags=re.IGNORECASE,
    )
    temporary_name = f"__legacy_fk_cleanup_{table_name}"
    bind.exec_driver_sql(f'DROP TABLE IF EXISTS "{temporary_name}"')
    table_pattern = (
        r'(CREATE TABLE\s+)(?:"' + re.escape(table_name) + r'"|' + re.escape(table_name) + r')'
    )
    modified_sql = re.sub(
        table_pattern,
        rf'\1"{temporary_name}"',
        modified_sql,
        count=1,
        flags=re.IGNORECASE,
    )
    bind.exec_driver_sql(modified_sql)
    columns = [
        row[1]
        for row in bind.exec_driver_sql(f'PRAGMA table_info("{table_name}")').fetchall()
    ]
    column_list = ", ".join(f'"{column}"' for column in columns)
    bind.exec_driver_sql(
        f'INSERT INTO "{temporary_name}" ({column_list}) '
        f'SELECT {column_list} FROM "{table_name}"'
    )
    bind.exec_driver_sql(f'DROP TABLE "{table_name}"')
    bind.exec_driver_sql(f'ALTER TABLE "{temporary_name}" RENAME TO "{table_name}"')
    for _, index_sql in index_rows:
        bind.exec_driver_sql(index_sql)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        raise RuntimeError("Legacy FK cleanup currently supports SQLite only")

    bind.exec_driver_sql("PRAGMA foreign_keys=OFF")
    bind.exec_driver_sql("PRAGMA legacy_alter_table=ON")

    if bind.exec_driver_sql(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='invoice_items'"
    ).fetchone():
        bind.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS invoice_items_legacy_product_refs (
                invoice_item_id INTEGER PRIMARY KEY,
                product_id INTEGER NOT NULL,
                captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        bind.exec_driver_sql(
            """
            INSERT OR IGNORE INTO invoice_items_legacy_product_refs
                (invoice_item_id, product_id)
            SELECT id, product_id
            FROM invoice_items
            WHERE product_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM products WHERE products.id = invoice_items.product_id)
            """
        )
        bind.exec_driver_sql(
            """
            UPDATE invoice_items
            SET product_id = NULL
            WHERE product_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM products WHERE products.id = invoice_items.product_id)
            """
        )

    for table_name in ("invoices", "appointments", "barber_presence_logs", "users"):
        _rebuild_without_legacy_fk(bind, table_name)

    bind.exec_driver_sql("PRAGMA legacy_alter_table=OFF")
    bind.exec_driver_sql("PRAGMA foreign_keys=ON")
    violations = bind.exec_driver_sql("PRAGMA foreign_key_check").fetchall()
    if violations:
        raise RuntimeError(f"Foreign-key cleanup left {len(violations)} violations")


def downgrade() -> None:
    pass
