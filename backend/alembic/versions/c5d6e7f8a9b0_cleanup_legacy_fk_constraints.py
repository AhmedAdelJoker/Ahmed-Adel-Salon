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


# Tables carrying the vestigial `barber_id -> barbers(id)` constraint.
#
# `service_sessions` is in this list because a real PostgreSQL run showed it
# holding the constraint while its model declares only `employees.id`. It was
# missed in the SQLite schema this migration was written against, where
# `service_sessions` had already been rebuilt.
TABLES_WITH_LEGACY_FK = (
    "invoices",
    "appointments",
    "barber_presence_logs",
    "users",
    "service_sessions",
)


def _drop_legacy_fk_postgres(bind, table_name: str) -> None:
    """Drops the unnamed `barber_id -> barbers(id)` constraint on PostgreSQL.

    SQLite needs a full table rebuild to remove a foreign key; PostgreSQL does
    not. The constraints are looked up by definition rather than by name, because
    the legacy one was created without one and so has an auto-generated name
    that differs between the two places this schema was built from.

    Only constraints that mention both `barber_id` and `barbers` are touched, so
    the named `fk_<table>_barber_employee` constraint on the same column is not
    collateral damage.

    The table name is interpolated through `_regclass_literal` rather than
    bound; see that function for why a bind parameter is the wrong tool here.

    The two `ILIKE` patterns *are* bound, and with `sa.text` rather than a plain
    string. `exec_driver_sql` inspects a raw string for `%` and hands whatever
    looks like a parameter to the driver, so a literal `'%barber_id%'` in plain
    SQL arrives as an empty bind value and the statement is rejected with
    "immutabledict is not a sequence". `sa.text` with an explicit `bindparam` is
    the form SQLAlchemy expects.
    """
    regclass = _regclass_literal(table_name)
    rows = bind.execute(
        sa.text(
            f"""
            SELECT conname FROM pg_constraint
            WHERE conrelid = to_regclass({regclass})
              AND contype = 'f'
              AND pg_get_constraintdef(oid) ILIKE :column_pattern
              AND pg_get_constraintdef(oid) ILIKE :parent_pattern
            """
        ).bindparams(
            sa.bindparam("column_pattern", value="%barber_id%"),
            sa.bindparam("parent_pattern", value="%barbers%"),
        )
    ).fetchall()
    for (constraint_name,) in rows:
        bind.exec_driver_sql(
            f'ALTER TABLE "{table_name}" DROP CONSTRAINT "{constraint_name}"'
        )


_SAFE_IDENTIFIER = re.compile(r"\A[A-Za-z_][A-Za-z0-9_]{0,62}\Z")


def _quote_identifier(name: str) -> str:
    """Validates a table name and returns it quoted for interpolation.

    These lookups are written with a literal rather than a bind parameter, and
    deliberately so. `to_regclass(:name)` looks correct but is not: SQLAlchemy
    hands the statement to psycopg2, which reads `:name` as a type cast, and the
    statement dies with "syntax error at or near ':'" or
    "Boolean value of this clause is not defined" depending on the shape.

    An identifier is a grammar element and cannot be a bind parameter in any
    case. Every name passed here is a literal from `TABLES_WITH_LEGACY_FK` or a
    call site in this file, so the check below is a guard against a future
    caller rather than against present input.
    """
    if not isinstance(name, str) or not _SAFE_IDENTIFIER.match(name):
        raise ValueError(f"refusing to build SQL: {name!r} is not a table identifier")
    return '"' + name + '"'


def _regclass_literal(name: str) -> str:
    """A SQL string literal naming a table, for use inside `to_regclass()`.

    Separate from `_quote_identifier` because the two want different things and
    conflating them is a silent, confusing failure: `to_regclass("invoice_items")`
    -- the quoted identifier with no surrounding string quotes -- is valid SQL
    that asks for a *column* named invoice_items, so it raises
    `UndefinedColumn: column "invoice_items" does not exist`. That reads like a
    missing table and is not.
    """
    return "'" + _quote_identifier(name) + "'"


def _table_exists(bind, table_name: str) -> bool:
    # `sa.text`, not a raw f-string. `exec_driver_sql` scans a raw string for `%`
    # and hands what it finds to the driver as parameters, so a literal inside one
    # arrives empty and the call fails with "immutabledict is not a sequence".
    # `sa.text` skips that scan.
    #
    # `WHERE to_regclass(...) IS NOT NULL` rather than testing the value in
    # Python, because `to_regclass` returns the name as *text* and whether
    # `.scalar()` hands back a string or a relation object differs between the
    # execution paths; `IS NOT NULL` is the same question either way, and the
    # predicate is evaluated by PostgreSQL rather than by whichever driver
    # happened to be in use.
    result = bind.execute(
        sa.text(
            f"SELECT to_regclass({_regclass_literal(table_name)}) IS NOT NULL AS present"
        )
    ).scalar()
    return bool(result)


def _null_dangling_product_refs_postgres(bind) -> None:
    """PostgreSQL equivalent of the SQLite `invoice_items` repair.

    SQLite cannot insert into a table twice without `INSERT OR IGNORE`, so the
    two dialects diverge on the conflict clause. The intent is identical: keep a
    record of the orphaned ids, then clear the live reference.
    """
    if not _table_exists(bind, "invoice_items"):
        return
    # `IF NOT EXISTS` is avoided deliberately. SQLAlchemy's text parser treats
    # the `:NOT` in `IF NOT EXISTS` as a bind parameter, so the statement fails
    # with "Boolean value of this clause is not defined" -- the colon is being
    # read as a placeholder by the very layer that would have bound it.
    # Existence is checked above instead.
    if not _table_exists(bind, "invoice_items_legacy_product_refs"):
        bind.execute(
            sa.text(
                """
                CREATE TABLE invoice_items_legacy_product_refs (
                    invoice_item_id INTEGER PRIMARY KEY,
                    product_id INTEGER NOT NULL,
                    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
    bind.execute(
        sa.text(
            """
            INSERT INTO invoice_items_legacy_product_refs (invoice_item_id, product_id)
            SELECT ii.id, ii.product_id
            FROM invoice_items ii
            WHERE ii.product_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = ii.product_id)
            ON CONFLICT (invoice_item_id) DO NOTHING
            """
        )
    )
    # `AS` is explicit on both statements. Without it, `UPDATE invoice_items ii`
    # is legal PostgreSQL but reads as `ii` being a type cast to the driver, and
    # the failure is `TypeError: Boolean value of this clause is not defined` --
    # a message that points at SQLAlchemy rather than at the missing keyword.
    bind.execute(
        sa.text(
            """
            UPDATE invoice_items AS ii
            SET product_id = NULL
            WHERE ii.product_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = ii.product_id)
            """
        )
    )


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name != "sqlite":
        # PostgreSQL path, added once a real server was available to test it
        # against. The bail-out that used to stand here meant the migration
        # history could never be replayed on PostgreSQL at all, so every fresh
        # PostgreSQL deployment was forced through `create_all` + stamp and the
        # migrations themselves were unexercised. That is the class of bug this
        # file's own `server_default` siblings had been hiding.
        _null_dangling_product_refs_postgres(bind)
        for table_name in TABLES_WITH_LEGACY_FK:
            _drop_legacy_fk_postgres(bind, table_name)
        return

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

    for table_name in TABLES_WITH_LEGACY_FK:
        _rebuild_without_legacy_fk(bind, table_name)

    bind.exec_driver_sql("PRAGMA legacy_alter_table=OFF")
    bind.exec_driver_sql("PRAGMA foreign_keys=ON")
    violations = bind.exec_driver_sql("PRAGMA foreign_key_check").fetchall()
    if violations:
        raise RuntimeError(f"Foreign-key cleanup left {len(violations)} violations")


def downgrade() -> None:
    pass
