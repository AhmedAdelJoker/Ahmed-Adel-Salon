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

        connection.execute(
            text("UPDATE products SET unit = 'g' WHERE unit IS NULL OR unit = '' OR unit = 'pcs'")
        )
        connection.execute(
            text("UPDATE services SET category = 'عام' WHERE category IS NULL OR TRIM(category) = ''")
        )
