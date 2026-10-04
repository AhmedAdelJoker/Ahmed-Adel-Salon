"""Liveness/readiness probes.

``/health`` is a shallow liveness check: the process is up and the app object
built. ``/health/ready`` is the one a load balancer should poll — it actually
touches the database, so a backend that cannot reach its datastore is reported
unhealthy instead of quietly serving 500s.
"""

from datetime import datetime

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.clock import salon_now, salon_timezone
from app.core.working_hours import current_window, summarize
from app.core.config import settings
from app.db.session import SessionLocal

router = APIRouter(tags=["Health"])

_STARTED_AT = datetime.now()


@router.get("/health", include_in_schema=False)
def health() -> dict:
    """Liveness — never touches the database on purpose."""
    return {
        "status": "ok",
        "uptime_seconds": int((datetime.now() - _STARTED_AT).total_seconds()),
        "salon_timezone": str(salon_timezone()),
        "salon_time": salon_now().isoformat(timespec="seconds"),
    }


@router.get("/health/ready", include_in_schema=False)
def readiness(response: Response) -> dict:
    """Readiness — pings the database and reports the operational picture."""
    checks: dict[str, dict] = {}
    healthy = True

    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            checks["database"] = {"status": "ok"}
        finally:
            db.close()
    except Exception as exc:  # pragma: no cover - depends on a real outage
        healthy = False
        checks["database"] = {"status": "error", "detail": str(exc)[:200]}

    try:
        db = SessionLocal()
        try:
            from app.models.business_settings import BusinessSettings

            row = db.query(BusinessSettings).first()
            if row is None or not row.working_hours:
                checks["working_hours"] = {"status": "not_configured"}
            else:
                window = current_window(row.working_hours, salon_now())
                summary = summarize(row.working_hours)
                checks["working_hours"] = {
                    "status": "ok",
                    "is_open_now": window is not None,
                    "open_days": summary["open_days"],
                    "overnight_days": summary["overnight_days"],
                }
        finally:
            db.close()
    except Exception as exc:  # pragma: no cover
        healthy = False
        checks["working_hours"] = {"status": "error", "detail": str(exc)[:200]}

    # Scheduler topology.
    #
    # Reported, not enforced. The distinction matters operationally: with
    # "redis" every replica's scheduler is safe to run because the job lock
    # elects one; with "local" each replica runs every job independently, so
    # a multi-replica deployment on "local" will send duplicate reports and race
    # on shift closure. A load balancer that sees "local" with more than one
    # replica is misconfigured, and this is where that becomes visible.
    from app.core import limiter
    from app.core.scheduler_lock import backend_name as lock_backend

    lock_state = lock_backend()
    scheduler_running = False
    try:
        from app.main import scheduler

        scheduler_running = scheduler.running
    except Exception:  # pragma: no cover
        pass

    checks["scheduler"] = {
        "status": "ok" if lock_state == "redis" else "single_replica_only",
        "running_in_this_process": scheduler_running,
        "job_lock_backend": lock_state,
    }
    checks["rate_limit_backend"] = {"status": "ok", "backend": limiter.backend_name()}

    # Password hashing strength.
    #
    # `active_scheme()` returns "bcrypt" when the Argon2id CFFI extension cannot
    # round-trip in this process. Login still works and nothing is stored in the
    # clear, but bcrypt is CPU-bound where Argon2id is memory-hard, so the
    # practical resistance to offline cracking drops. That is worth an operator
    # seeing rather than discovering by reading logs, and it is reported and not
    # enforced: a broken native module is a reason to warn, not to refuse to
    # serve traffic, since refusing would lock every user out of the salon.
    from app.core.security import active_scheme

    scheme = active_scheme()
    checks["password_hashing"] = {
        "status": "ok" if scheme == "argon2id" else "degraded",
        "scheme": scheme,
    }
    if scheme != "argon2id":
        healthy = False

    # Mandatory 2FA.
    #
    # Reported, not enforced, for the same reason as the hasher above: an
    # operator who has switched enforcement off to recover a locked owner needs
    # the application to start, and a readiness probe that refuses would leave
    # them with no way back in at all. What it must not do is fail silently --
    # a disabled control should be visible to whoever is on call, on a dashboard,
    # not only in a log line from the process that happens to be running.
    from app.core.roles import ROLE_ALIASES

    enforcement_on = settings.TOTP_ENFORCEMENT_ENABLED
    privileged = [r for r in settings.TOTP_REQUIRED_ROLES]
    checks["two_factor"] = {
        "status": "ok" if enforcement_on else "disabled",
        "required_for": privileged,
        "grace_days": settings.TOTP_ENROLLMENT_GRACE_DAYS,
        "enforced": enforcement_on,
    }
    if not enforcement_on:
        healthy = False

    # A role in the required list that does not exist is a typo, and a typo here
    # silently exempts whoever holds it. Cheap to detect, invisible otherwise.
    unknown_roles = [r for r in privileged if r not in ROLE_ALIASES]
    if unknown_roles:
        checks["two_factor"]["unknown_roles"] = unknown_roles
        checks["two_factor"]["status"] = "misconfigured"
        healthy = False

    # Realtime topology.
    #
    # Same reasoning as the scheduler: reported, not enforced. Without a bus each
    # worker only delivers to the sockets it holds, so a broadcast produced on
    # one replica is invisible on the others. That is invisible in
    # single-replica development and produces "the POS board sometimes does not
    # update" in production.
    try:
        from app.services.websocket import manager

        checks["realtime"] = {
            "status": "ok" if lock_state == "redis" else "single_replica_only",
            "transport": lock_state,
            "local_sockets": manager.local_socket_count(),
            "subscribed": manager._listener is not None and not manager._listener.done(),
            "loop_bound": manager._loop is not None,
        }
    except Exception as exc:  # pragma: no cover
        checks["realtime"] = {"status": "error", "detail": str(exc)[:200]}

    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if healthy else "degraded",
        "checks": checks,
        "salon_time": salon_now().isoformat(timespec="seconds"),
    }
