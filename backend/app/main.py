from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pathlib import Path
from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import SessionLocal

from app.api.v1.api import api_router
from app.core.config import settings
from app.db.runtime_schema import ensure_runtime_schema
from app.db.seed import seed_data

logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_runtime_schema()
    seed_data()
    logger.info("Server started. Background scheduler for POS shifts is active.")
    yield
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass


_is_prod = (os.getenv("ENVIRONMENT") or settings.ENVIRONMENT) == "production"
app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    # Phase 3: never expose interactive docs / OpenAPI schema in production.
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)


# --- Background Tasks ---
def scheduled_shift_closure():
    """Task to automatically close expired POS shifts."""
    db = SessionLocal()
    try:
        from app.services.pos_shift_service import auto_close_expired_shifts
        closed_count = auto_close_expired_shifts(db)
        if closed_count > 0:
            logger.info("[Scheduler] Automatically closed %d POS shift(s).", closed_count)
    except Exception:
        logger.exception("[Scheduler] Error during auto-shift-closure")
    finally:
        db.close()


def scheduled_report_delivery():
    """Task to deliver due periodic financial reports."""
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
    """Task to delete old scheduled-report PDFs, keeping the most recent N."""
    from app.services.scheduled_reports import cleanup_old_pdfs
    try:
        import os
        keep_n = int(os.environ.get("SCHEDULED_PDF_KEEP", "20"))
        result = cleanup_old_pdfs(keep_n)
        if result["deleted"]:
            logger.info(
                "[Scheduler] Cleaned up %d old PDF(s). %d remaining.",
                result["deleted"], result["remaining"],
            )
    except Exception:
        logger.exception("[Scheduler] Error during PDF cleanup")

scheduler = BackgroundScheduler()
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
scheduler.start()


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
    expose_headers=["Content-Disposition", "X-Export-Empty", "X-Export-Filename", "X-Total-Count"],
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
