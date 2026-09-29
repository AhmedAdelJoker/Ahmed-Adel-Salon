from typing import List, Union

from pydantic import field_validator, model_validator
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
    SEED_DEMO_DATA: bool = False

    # IANA zone the salon physically operates in. Working hours, POS shifts and
    # attendance are wall-clock concepts and must be evaluated in this zone, not
    # the server's. Falls back to UTC+03:00 when the name cannot be resolved.
    SALON_TIMEZONE: str = "Africa/Cairo"

    DATABASE_URL: str

    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Short-lived access tokens (1 hour)
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for refresh

    # ------------------------------------------------------------------ #
    # Mandatory two-factor authentication
    # ------------------------------------------------------------------ #
    # TOTP is implemented and works, but nothing required it. Any account could
    # -- including `owner`, the highest privilege in the system -- run on a
    # password alone. That makes the password the single remaining control on
    # total compromise: one leaked credential is one leaked salon.
    #
    # These three settings turn the feature from available into required, and
    # they are separated on purpose:
    #
    # * ROLES decides *who*. `barber` and `cashier` are left out by default
    #   because forcing a second factor on the person at the till is a support
    #   burden, and a shared till phone is a weak second factor anyway. Owners,
    #   admins and managers are where the blast radius lives.
    # * GRACE_DAYS decides *when to start*. Measured from first successful login,
    #   not from account creation, so an account provisioned months before this
    #   shipped is not instantly bricked on the next sign-in. Seven days is
    #   enough to install an authenticator app during a shift.
    # * ENABLED is the break-glass. Setting it false stops enforcement
    #   everywhere, immediately, for the case where an owner loses their phone
    #   with no recovery code and the only way back is the database. It is
    #   logged at ERROR on startup so a disabled control is never silent, and
    #   /health/ready reports it as degraded.
    TOTP_REQUIRED_ROLES: List[str] = ["owner", "admin", "manager"]
    TOTP_ENROLLMENT_GRACE_DAYS: int = 7
    TOTP_ENFORCEMENT_ENABLED: bool = True

    # Where that "first successful login" is recorded. It is a user column, not a
    # setting, because the deadline is per account.
    TOTP_ENROLLMENT_DEADLINE_DAYS: int = 7

    BACKEND_CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
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
    # Settings are small, precious documents; a stuck client or a loop should
    # not be able to hammer them into an inconsistent state.
    SETTINGS_WRITE_RATE_LIMIT_MAX_REQUESTS: int = 30

    # ============================================================
    # Security hardening (Phase 3)
    # ============================================================
    ACCOUNT_LOCKOUT_THRESHOLD: int = 5  # Failed login attempts before lockout
    ACCOUNT_LOCKOUT_WINDOW_SECONDS: int = 60  # Time window for counting failed attempts
    ACCOUNT_LOCKOUT_DURATION_MINUTES: int = 15  # How long the account stays locked

    # ============================================================
    # Reverse proxy trust
    # ============================================================
    # Peers whose X-Forwarded-For / X-Real-IP headers are believed.
    #
    # Empty by default, and that default is the safe one. Trusting a forwarding
    # header means trusting whoever sent it: an untrusted client that reaches
    # the app directly can put any address it likes in the header and mint
    # itself a fresh rate-limit bucket and a fresh lockout identity on every
    # request. Only list the load balancer or reverse proxy that is actually
    # in front of the app.
    #
    # "0" additionally means "use the socket peer", which is the correct value
    # when the app is not behind a proxy at all.
    TRUSTED_PROXY_IPS: Union[str, List[str]] = ""

    # ============================================================
    # Redis — shared state for horizontal scaling
    # ============================================================
    # Empty disables Redis and every limiter falls back to per-process memory.
    # That fallback is safe but not shared, so with more than one worker each
    # worker enforces its own quota: the deployment is weaker than it looks.
    # Set this in any multi-replica deployment.
    REDIS_URL: str = ""
    REDIS_SOCKET_TIMEOUT_SECONDS: float = 0.5

    # Upper bound on tracked rate-limit keys in the in-memory fallback. Without
    # it, an attacker rotating source addresses (trivial over IPv6, where a
    # single host owns a /64) grows the process heap until it is killed. The
    # fallback is per-process, so the ceiling is generous.
    RATE_LIMIT_MAX_TRACKED_KEYS: int = 20_000

    # ============================================================
    # Password hashing (Argon2id)
    # ============================================================
    # OWASP Password Storage Cheat Sheet baseline for Argon2id:
    #   m=19456 KiB (19 MiB), t=2, p=1
    #
    # These are defaults, not constants. The right cost is a property of the
    # server: a small VPS cannot afford 19 MiB and two passes on every login
    # without its request latency collapsing, while a dedicated host can afford
    # considerably more. Raise them to make a stolen database expensive to
    # crack; lower them only if the server genuinely cannot keep up, and
    # understand that doing so hands the attacker back their advantage.
    #
    # Existing bcrypt hashes are verified and then transparently replaced with
    # Argon2id on the user's next successful sign-in, so these values can be
    # raised at any time without invalidating anyone's credentials.
    ARGON2_MEMORY_KIB: int = 19_456
    ARGON2_TIME_COST: int = 2
    ARGON2_PARALLELISM: int = 1

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
    META_WA_APP_SECRET: str | None = None

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

    @field_validator("ALLOWED_HOSTS", "TRUSTED_PROXY_IPS", mode="before")
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

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.ENVIRONMENT == "production" and self.SECRET_KEY == "test-secret-key-for-testing-only":
            raise ValueError("Test SECRET_KEY cannot be used in production")
        return self


settings = Settings()
