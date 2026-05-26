from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pathlib import Path

from app.api.v1.api import api_router
from app.core.config import settings
from app.db.runtime_schema import ensure_runtime_schema
from app.db.seed import seed_data

app = FastAPI(title=settings.PROJECT_NAME)


# ✅ startup event
@app.on_event("startup")
def startup_event():
    ensure_runtime_schema()
    seed_data()


uploads_dir = Path(__file__).resolve().parents[2] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


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
