from contextlib import asynccontextmanager
import logging
import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pathlib import Path
from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import SessionLocal
from app.core.logging_setup import (
    access_logger,
    bind_request,
    configure_logging,
    new_request_id,
)
from app.core.scheduler_lock import job_lock

from app.api.v1.api import api_router
from app.core.config import settings
from app.db.runtime_schema import ensure_runtime_schema
from app.db.seed import seed_data

logger = logging.getLogger("app.main")

# Created here, started in `lifespan`. See `start_scheduler` for why.
scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_runtime_schema()
    seed_data(include_demo_data=not _is_prod or settings.SEED_DEMO_DATA)

    # Bind the loop that owns the WebSocket objects before anything can publish
    # to them, then start listening on the shared bus. Without this a sync
    # endpoint — which runs on a worker thread — has no way back to the sockets.
    import asyncio

    from app.services.websocket import manager

    manager.bind_loop(asyncio.get_running_loop())
    await manager.start_subscriber()

    start_scheduler()
    try:
        yield
    finally:
        # Always reached now, including on a failed startup. Previously the
        # shutdown was best-effort and the scheduler had been running since
        # import, so a process that imported the module without serving
        # requests kept firing jobs forever.
        await manager.stop_subscriber()
        shutdown_scheduler()


def _scheduler_enabled() -> bool:
    """Whether this process should run scheduled jobs at all.

    Disabled in tests: the suite imports `app.main`, and a live scheduler would
    fire background jobs against the test database on a timer nobody asked for.
    Also the switch a single-replica deployment uses when it wants jobs to run
    in exactly one process rather than relying on the distributed lock.
    """
    if settings.TESTING:
        return False
    from app.core.config import Settings  # noqa: F401  (documented below)

    import os as _os

    raw = _os.getenv("SCHEDULER_ENABLED")
    if raw is None:
        return True
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def start_scheduler() -> None:
    """Starts the background scheduler for this process.

    Called from the lifespan, not at import. With more than one worker every
    process starts its own scheduler, which is fine because each job runs under
    a Redis lock and the others skip — but only one of them may be started at
    all, or merely importing the module would start background work.
    """
    if not _scheduler_enabled():
        logger.info("Background scheduler disabled for this process.")
        return
    if scheduler.running:
        return
    scheduler.start()
    logger.info(
        "Background scheduler started (job locks: %s).",
        "redis" if _job_lock_backend() == "redis" else "process-local",
    )


def shutdown_scheduler() -> None:
    if scheduler.running:
        try:
            scheduler.shutdown(wait=False)
            logger.info("Background scheduler stopped.")
        except Exception:  # pragma: no cover - shutdown is best effort
            logger.exception("Failed to stop the background scheduler cleanly")


def _job_lock_backend() -> str:
    from app.core.scheduler_lock import backend_name

    return backend_name()


_is_prod = (os.getenv("ENVIRONMENT") or settings.ENVIRONMENT) == "production"
configure_logging(level="WARNING" if settings.TESTING else "INFO")
app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    # Phase 3: never expose interactive docs / OpenAPI schema in production.
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)


# --- Background Tasks ---
# Each job is wrapped in a distributed lock. With N replicas the scheduler fires
# on all of them, and without the lock a customer would receive the same
# financial report N times in a single tick while two workers also raced to
# close the same POS shift.
def scheduled_shift_closure():
    """Automatically close POS shifts that are past their closing time.

    The lock TTL is set above the job's worst case: it closes a bounded window of
    shifts and writes one notification each. It must never expire while the job
    is still running, or the next worker's copy would start concurrently.
    """
    with job_lock("auto_close_shifts", ttl_seconds=300) as acquired:
        if not acquired:
            return
        db = SessionLocal()
        try:
            from app.services.pos_shift_service import auto_close_expired_shifts

            closed_count = auto_close_expired_shifts(db)
            if closed_count > 0:
                logger.info("[Scheduler] Automatically closed %d POS shift(s).", closed_count)
        except Exception:
            # Swallowed on purpose: a job that raises would be logged by
            # APScheduler and rescheduled, but letting it propagate would stop
            # every subsequent run. The lock is released by the context manager
            # either way, so one bad day does not wedge the schedule.
            logger.exception("[Scheduler] Error during auto-shift-closure")
        finally:
            db.close()


def scheduled_report_delivery():
    """Deliver due periodic financial reports.

    This one does network I/O — it renders a PDF and calls the WhatsApp Cloud
    API with a 60s timeout per message — so its TTL is the longest of the three.
    """
    with job_lock("scheduled_report_delivery", ttl_seconds=1800) as acquired:
        if not acquired:
            return
        db = SessionLocal()
        try:
            from app.services.scheduled_reports import run_due_schedules

            results = run_due_schedules(db)
            if results:
                logger.info("[Scheduler] Delivered %d scheduled report(s).", len(results))
        except Exception:
            logger.exception("[Scheduler] Error during scheduled-report-delivery")
        finally:
            db.close()


def cleanup_scheduled_reports():
    """Delete old scheduled-report PDFs, keeping the most recent N."""
    with job_lock("cleanup_scheduled_pdfs", ttl_seconds=900) as acquired:
        if not acquired:
            return
        try:
            keep_n = int(os.environ.get("SCHEDULED_PDF_KEEP", "20"))
            from app.services.scheduled_reports import cleanup_old_pdfs

            result = cleanup_old_pdfs(keep_n)
            if result["deleted"]:
                logger.info(
                    "[Scheduler] Cleaned up %d old PDF(s). %d remaining.",
                    result["deleted"],
                    result["remaining"],
                )
        except Exception:
            logger.exception("[Scheduler] Error during PDF cleanup")


def _register_jobs() -> None:
    """Declares the schedule. Split from `start_scheduler` so the job table can
    be inspected in tests without starting a thread pool."""
    scheduler.add_job(
        scheduled_shift_closure,
        "interval",
        minutes=15,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        id="auto_close_shifts",
        replace_existing=True,
    )
    scheduler.add_job(
        scheduled_report_delivery,
        "interval",
        minutes=30,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
        id="scheduled_report_delivery",
        replace_existing=True,
    )
    scheduler.add_job(
        cleanup_scheduled_reports,
        "interval",
        hours=24,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
        id="cleanup_scheduled_pdfs",
        replace_existing=True,
    )


_register_jobs()


def _resolve_uploads_dir() -> Path:
    """Single canonical resolver — delegates to app.core.paths (SOT) with idempotent migration."""
    from app.core.paths import get_uploads_dir, migrate_legacy_data

    try:
        migrate_legacy_data()
    except Exception:
        pass
    return get_uploads_dir()

uploads_dir = _resolve_uploads_dir()
uploads_dir.mkdir(parents=True, exist_ok=True)

# ensure sub-directories exist (idempotent)
for sub in [
    "business", "products", "services", "employees", "invoices",
    "documents", "profiles", "expenses", "offers", "scheduled_reports",
]:
    (uploads_dir / sub).mkdir(parents=True, exist_ok=True)

for public_subdir in (
    "business",
    "products",
    "services",
    "employees",
    "profiles",
    "offers",
):
    app.mount(
        f"/uploads/{public_subdir}",
        StaticFiles(directory=str(uploads_dir / public_subdir)),
        name=f"uploads-{public_subdir}",
    )


# Use configured allowed hosts, fallback to localhost for dev
_allowed_hosts = settings.ALLOWED_HOSTS if isinstance(settings.ALLOWED_HOSTS, list) else [settings.ALLOWED_HOSTS]
if not _allowed_hosts:
    _allowed_hosts = ["localhost", "127.0.0.1"]
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_allowed_hosts,
)


# CORS Middleware — local dev origins only (5173 per project rules; no :3000)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if settings.BACKEND_CORS_ORIGINS:
    if isinstance(settings.BACKEND_CORS_ORIGINS, str):
        origins.append(settings.BACKEND_CORS_ORIGINS)
    else:
        origins.extend(settings.BACKEND_CORS_ORIGINS)

# Remove duplicates and trailing slashes
origins = list(set([str(o).rstrip("/") for o in origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin"],
    expose_headers=[
        "Content-Disposition",
        "X-Export-Empty",
        "X-Export-Filename",
        "X-Total-Count",
        "X-2FA-Required",
    ],
)


# Global exception handler — ensure CORS headers are attached even on unhandled 500s
# so the browser shows the real error instead of a misleading CORS failure.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import traceback
    import logging

    logger = logging.getLogger("app.unhandled")
    logger.error(f"[UNHANDLED] {request.method} {request.url.path}: {exc}", exc_info=True)
    # Don't leak internal error details to client
    response = JSONResponse(
        status_code=500,
        content={"detail": "حدث خطأ داخلي، حاول مرة أخرى"},
    )
    origin = request.headers.get("origin")
    if origin and origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a request id and log one structured line per request."""
    inbound = request.headers.get("x-request-id")
    request_id = bind_request(inbound[:64] if inbound else new_request_id(), request.url.path)
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started) * 1000
        access_logger().exception(
            "%s %s -> 500 in %.0fms",
            request.method,
            request.url.path,
            elapsed_ms,
        )
        raise
    elapsed_ms = (time.perf_counter() - started) * 1000
    level = (
        logging.WARNING
        if response.status_code >= 500
        else logging.INFO
        if response.status_code >= 400
        else logging.DEBUG
    )
    access_logger().log(
        level,
        "%s %s -> %s in %.0fms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    # Strict-Transport-Security: tell browsers to upgrade to HTTPS for 1 year,
    # including subdomains. Safe to send even over HTTP because browsers ignore
    # it on plain HTTP. Activates the moment the app is served behind HTTPS.
    response.headers.setdefault(
        "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
    )
    # Content-Security-Policy: defense-in-depth against XSS.
    # - default-src 'self': only same-origin by default
    # - img-src 'self' data: blob: https:: allow image previews from local blobs and HTTPS sources
    # - script-src 'self': no inline scripts (SPA bundle is served same-origin)
    # - style-src 'self' 'unsafe-inline': inline styles for component libraries
    # - connect-src 'self' ws: wss: http://localhost:5173: API + dev HMR
    # - frame-ancestors 'none': equivalent to X-Frame-Options: DENY
    response.headers.setdefault("Content-Security-Policy", settings.CSP_POLICY)
    # Cross-Origin policies: isolate the app from other origins' resources
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")

    if request.url.path.startswith("/api/v1/auth"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"

    return response


app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "SalonPro backend is running"}


@app.get("/health")
def health():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "error"})
    finally:
        db.close()
