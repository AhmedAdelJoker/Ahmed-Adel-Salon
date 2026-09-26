import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from app.db.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    """Resolve the URL the app itself uses.

    Alembic must migrate the SAME database the application connects to.
    Previously it always used the alembic.ini default, so a deployment that
    set DATABASE_URL (e.g. PostgreSQL) in .env would migrate a stray SQLite
    file instead. Precedence: process env > app settings (.env) > alembic.ini.
    """
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    try:
        from app.core.config import settings

        url = getattr(settings, "DATABASE_URL", None)
        if url:
            return url
    except Exception:
        # Settings can fail validation (e.g. SECRET_KEY not set yet during a
        # first-run migration) — fall back to the alembic.ini default.
        pass
    return config.get_main_option("sqlalchemy.url")


def run_migrations_offline() -> None:
    """Run migrations in offline mode."""
    url = _database_url()

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in online mode."""
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

