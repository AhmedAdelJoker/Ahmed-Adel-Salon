from typing import List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SalonPro"
    APP_NAME: str = "SalonPro"
    API_V1_STR: str = "/api/v1"

    # runtime environment: development | production
    ENVIRONMENT: str = "development"
    # Explicit test-mode flag (set TESTING=true in test env). Feature gates
    # must use this instead of sniffing DATABASE_URL filenames.
    TESTING: bool = False

    DATABASE_URL: str

    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Short-lived access tokens (1 hour)
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for refresh

    BACKEND_CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    ALLOWED_HOSTS: Union[str, List[str]] = [
        "localhost",
        "127.0.0.1",
    ]

    FIRST_SUPERUSER: str = "admin"
    FIRST_SUPERUSER_PASSWORD: str

    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = 5
    PUBLIC_RATE_LIMIT_MAX_REQUESTS: int = 30
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ============================================================
    # Security hardening (Phase 3)
    # ============================================================
    ACCOUNT_LOCKOUT_THRESHOLD: int = 5  # Failed login attempts before lockout
    ACCOUNT_LOCKOUT_WINDOW_SECONDS: int = 60  # Time window for counting failed attempts
    ACCOUNT_LOCKOUT_DURATION_MINUTES: int = 15  # How long the account stays locked

    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB default cap
    ALLOWED_UPLOAD_EXTENSIONS: str = "pdf,png,jpg,jpeg,webp,xlsx,csv"
    UPLOAD_FILENAME_SAFE: bool = True  # Sanitize filenames server-side

    CSP_POLICY: str = (
        "default-src 'self'; "
        "img-src 'self' data: blob: https:; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "font-src 'self' data:; "
        "connect-src 'self' ws: wss: http://localhost:5173 http://127.0.0.1:5173; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )

    META_GRAPH_API_VERSION: str = "v23.0"
    META_WA_PHONE_NUMBER_ID: str | None = None
    META_WA_ACCESS_TOKEN: str | None = None
    META_WA_VERIFY_TOKEN: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value):
        if isinstance(value, str):
            if value.startswith("[") and value.endswith("]"):
                import json
                return json.loads(value)
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("ALLOWED_HOSTS", mode="before")
    @classmethod
    def assemble_allowed_hosts(cls, value):
        if isinstance(value, str):
            if value.startswith("[") and value.endswith("]"):
                import json
                return json.loads(value)
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        weak_defaults = {
            "SUPER_SECRET_KEY_CHANGE_ME",
            "SUPER_SECRET_KEY_CHANGE_ME_FOR_PRODUCTION",
            "change_this_secret",
            "SUPER_SECRET_KEY",
        }
        # Allow test secret via env var override
        if v == "test-secret-key-for-testing-only":
            return v
        if v in weak_defaults:
            raise ValueError("SECRET_KEY must be changed from default weak value")
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @field_validator("FIRST_SUPERUSER_PASSWORD")
    @classmethod
    def validate_superuser_password(cls, v: str) -> str:
        if v in {"admin123", "Admin@123", "252525", "password"}:
            raise ValueError("FIRST_SUPERUSER_PASSWORD is too weak")
        if len(v) < 8:
            raise ValueError("FIRST_SUPERUSER_PASSWORD must be at least 8 characters")
        return v


settings = Settings()
