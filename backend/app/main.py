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

app = FastAPI(title=settings.PROJECT_NAME)


# --- Background Tasks ---
def scheduled_shift_closure():
    """Task to automatically close expired POS shifts."""
    db = SessionLocal()
    try:
        from app.services.pos_shift_service import auto_close_expired_shifts
        closed_count = auto_close_expired_shifts(db)
        if closed_count > 0:
            print(f"[Scheduler] Automatically closed {closed_count} POS shift(s).")
    except Exception as e:
        print(f"[Scheduler] Error during auto-shift-closure: {e}")
    finally:
        db.close()

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
scheduler.start()


# ✅ startup/shutdown events
@app.on_event("startup")
def startup_event():
    ensure_runtime_schema()
    seed_data()
    print("Server started. Background scheduler for POS shifts is active.")


@app.on_event("shutdown")
def shutdown_event():
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass



def _resolve_uploads_dir() -> Path:
    import os
    env_dir = os.getenv("UPLOADS_DIR")
    if env_dir:
        return Path(env_dir)
    cur = Path(__file__).resolve()
    # Docker detection: code lives under /app
    if cur.as_posix().startswith("/app/"):
        return Path("/app/uploads")
    # Local dev: backend/app/main.py -> parents[2] == project root (Salon-Management-Pro)
    # parents[2] works for both local and keeps backward compat
    candidate = cur.parents[2] / "uploads"
    # Fallback to parents[3] for legacy media.py location handling
    if candidate.exists() or (cur.parents[2] / "backend").exists():
        return candidate
    return cur.parents[3] / "uploads"

uploads_dir = _resolve_uploads_dir()
uploads_dir.mkdir(parents=True, exist_ok=True)

# ensure sub-directories exist
for sub in ["business", "products", "services", "employees", "invoices", "documents", "profiles", "expenses"]:
    (uploads_dir / sub).mkdir(parents=True, exist_ok=True)

# Ensure backward-compat: migrate files from legacy wrong paths
try:
    import shutil
    legacy_paths = [
        Path(__file__).resolve().parents[3] / "uploads",  # Downloads/uploads (old bug)
        Path(__file__).resolve().parents[2] / "backend" / "uploads",  # backend/uploads (intermediate bug)
    ]
    for legacy_wrong in legacy_paths:
        if legacy_wrong.exists() and legacy_wrong.resolve() != uploads_dir.resolve():
            for sub in ["profiles", "business", "products", "services", "documents", "expenses"]:
                src_sub = legacy_wrong / sub
                if src_sub.exists():
                    dest_sub = uploads_dir / sub
                    dest_sub.mkdir(parents=True, exist_ok=True)
                    for item in src_sub.glob("*"):
                        if item.is_file():
                            dest = dest_sub / item.name
                            if not dest.exists():
                                try:
                                    shutil.copy2(item, dest)
                                except Exception:
                                    pass
except Exception as _e:
    print(f"[uploads] legacy migration warning: {_e}")

app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"], # Relaxed for development to avoid port-matching issues
)


# CORS Middleware
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Export-Empty", "X-Export-Filename"],
)


# Global exception handler — ensure CORS headers are attached even on unhandled 500s
# so the browser shows the real error instead of a misleading CORS failure.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"[UNHANDLED] {request.method} {request.url.path}: {exc}")
    traceback.print_exc()
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
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

    if request.url.path.startswith("/api/v1/auth"):
        response.headers["Cache-Control"] = "no-store"

    return response


app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "SalonPro backend is running"}
