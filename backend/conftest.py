import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["FIRST_SUPERUSER"] = "admin"
os.environ["FIRST_SUPERUSER_PASSWORD"] = "TestAdmin123"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base_class import Base
from app.db.session import get_db
from app.core.rate_limit import limiter

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    limiter._events.clear()
    Base.metadata.create_all(bind=engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=OFF"))
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f'DROP TABLE IF EXISTS "{table.name}"'))
        conn.execute(text("PRAGMA foreign_keys=ON"))
    limiter._events.clear()


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)
