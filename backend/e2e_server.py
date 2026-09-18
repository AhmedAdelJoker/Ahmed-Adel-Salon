"""Dev-only E2E launcher: fresh sqlite DB + uvicorn on :8000.

Used by frontend/playwright.smoke.config.ts. Never import from app code.
"""

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

db_path = os.path.join(tempfile.gettempdir(), "smoke-e2e.db")
if os.path.exists(db_path):
    os.remove(db_path)

os.environ["DATABASE_URL"] = "sqlite:///" + db_path.replace("\\", "/")
# NOTE: set explicitly — must not depend on CWD/.env discovery.
os.environ["FIRST_SUPERUSER"] = "admin"
# NOTE: must satisfy validate_superuser_password (admin123 is rejected).
os.environ["FIRST_SUPERUSER_PASSWORD"] = "TestAdmin123"
# E2E preview runs on :5174 (dev :5173 stays for humans) — allow both origins.
os.environ["BACKEND_CORS_ORIGINS"] = (
    "http://127.0.0.1:5174,http://localhost:5174,"
    "http://127.0.0.1:5173,http://localhost:5173"
)

import uvicorn

if __name__ == "__main__":
    # NOTE: 8000 is taken by the dev server — E2E uses 18001.
    uvicorn.run("app.main:app", host="127.0.0.1", port=18001, log_level="warning")
