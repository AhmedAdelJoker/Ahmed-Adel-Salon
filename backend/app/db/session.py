from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
import os
from pathlib import Path

from app.core.config import settings

# لو في مجلد خارجي، حوّل DATABASE_URL النسبي لمسار مطلق خارج المشروع
def _resolve_database_url(url: str) -> str:
    if not url.startswith("sqlite"):
        return url
    # لو مضبوط بمسار مطلق من Electron (SALON_DATA_DIR) نحترمه
    # sqlite:////C:/SalonProData/... أو sqlite:///C:/...
    if ":/" in url or url.startswith("sqlite:////"):
        return url
    # نسبي مثل sqlite:///./salon_pro.db -> نحوله للخارج
    try:
        from app.core.paths import get_db_path
        ext_db = get_db_path()
        # ext_db هو C:/.../SalonProData/data/salon_pro.db
        return f"sqlite:///{ext_db.as_posix()}"
    except Exception:
        return url

# حلّ الـ URL قبل إنشاء الـ engine
try:
    _orig_url = settings.DATABASE_URL
    _resolved = _resolve_database_url(_orig_url)
    if _resolved != _orig_url:
        # تجاوز القيمة في settings مؤقتاً
        object.__setattr__(settings, "DATABASE_URL", _resolved)
except Exception:
    pass


def _pool_kwargs() -> dict:
    if settings.DATABASE_URL.startswith("sqlite"):
        return {}
    return {
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),
    }


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
    **_pool_kwargs(),
)

# Enable WAL and FK for SQLite (prod + dev, not just tests)
if settings.DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()