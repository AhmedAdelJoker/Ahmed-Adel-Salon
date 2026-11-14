"""Launcher for the frozen backend.exe — starts uvicorn serving app.main:app.

PyInstaller entry point (see backend.spec). Passes the app OBJECT (not an
import string) so the frozen executable doesn't need module re-import.
"""
import os
import socket
import sys

import uvicorn


def port_owner(host: str, port: int) -> str | None:
    """Who already holds host:port, or None when the port is free.

    A second start used to fail with `[WinError 10013] An attempt was made to
    access a socket in a way forbidden by its access permissions`, which names
    neither the port nor the process and reads like a firewall problem. The
    real cause is that another instance already holds the port. `run.ps1`
    guards its own launch with Assert-PortFree; this is the same check for the
    frozen exe and for hand runs, which had nothing.
    """
    probe_host = "127.0.0.1" if host in ("", "0.0.0.0", "::") else host
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.5)
        if probe.connect_ex((probe_host, port)) != 0:
            return None

    try:
        import psutil
    except ImportError:
        return "another process"

    try:
        for conn in psutil.net_connections(kind="tcp"):
            if conn.status != psutil.CONN_LISTEN or not conn.laddr:
                continue
            if conn.laddr.port != port or not conn.pid:
                continue
            try:
                return f"{psutil.Process(conn.pid).name()} (PID {conn.pid})"
            except psutil.Error:
                return f"PID {conn.pid}"
    except psutil.Error:
        pass
    return "another process"


def main() -> int:
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8000"))

    owner = port_owner(host, port)
    if owner is not None:
        print(
            f"Backend will not start: {host}:{port} is already in use by {owner}.\n"
            "A backend is most likely already running: reuse that one, or stop it\n"
            "first (stop.ps1) and start again. Do not run a second instance on\n"
            "another port — without Redis the job lock is process-local, so the\n"
            "replicas would each run every scheduled job.",
            file=sys.stderr,
        )
        return 1

    # دلوقتي بس: لو البورت مشغول منستوردش التطبيق أصلاً
    from app.main import app

    # مهم: reload=False داخل الـ exe المجمد
    uvicorn.run(app, host=host, port=port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
