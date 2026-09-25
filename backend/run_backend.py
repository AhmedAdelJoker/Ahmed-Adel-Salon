"""Launcher for the frozen backend.exe — starts uvicorn serving app.main:app.

PyInstaller entry point (see backend.spec). Passes the app OBJECT (not an
import string) so the frozen executable doesn't need module re-import.
"""
import os
import sys

import uvicorn

from app.main import app


def main() -> None:
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    # مهم: reload=False داخل الـ exe المجمد
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    sys.exit(main())
