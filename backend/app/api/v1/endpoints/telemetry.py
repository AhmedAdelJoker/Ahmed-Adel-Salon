"""Client-side error intake.

The browser already has a root `ErrorBoundary` (the thing that stands between
a provider throw and a blank canvas). This endpoint is where its report lands,
so a black screen in production leaves a server-side trace instead of only a
console line that disappears with the tab.

Design constraints:
  - Reachable without a working session, because the client can lose its token
    *because* the app crashed. `get_current_user_optional` attributes the report
    when a token is present and yields ``None`` otherwise; it grants no access,
    it only fills in `user_id` on the audit row.
  - Never raises. A telemetry endpoint that 500s turns a recoverable UI error
    into a second, louder failure.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps_auth import get_current_user_optional
from app.core.audit import audit_log
from app.models.user import User

logger = logging.getLogger("app.client_errors")

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

MAX_MESSAGE = 500
MAX_STACK = 8000
MAX_COMPONENT_STACK = 4000


class ClientErrorPayload(BaseModel):
    message: str = Field(..., max_length=MAX_MESSAGE)
    stack: str | None = Field(default=None, max_length=MAX_STACK)
    componentStack: str | None = Field(default=None, max_length=MAX_COMPONENT_STACK)
    url: str | None = Field(default=None, max_length=500)
    userAgent: str | None = Field(default=None, max_length=300)
    timestamp: str | None = Field(default=None, max_length=40)
    release: str | None = Field(default=None, max_length=60)


@router.post("/client-errors", status_code=202)
def ingest_client_error(
    payload: ClientErrorPayload,
    request: Request,
    db: Session = Depends(deps.get_db),
    user: User | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    """Accept a browser error report. Always 202, never 4xx/5xx."""
    try:
        audit_log(
            db,
            request,
            user,
            action="client.error",
            entity_type="client",
            description={
                "message": payload.message,
                "url": payload.url,
                "release": payload.release,
                "timestamp": payload.timestamp,
                "stack": (payload.stack or "")[:MAX_STACK],
                "component_stack": (payload.componentStack or "")[:MAX_COMPONENT_STACK],
                "ua": (payload.userAgent or "")[:300],
            },
        )
    except Exception:
        # Belt and braces: audit_log already swallows, but a telemetry route
        # must never surface an error to the reporter.
        logger.warning("[telemetry] failed to record client error", exc_info=True)

    return {"status": "accepted"}