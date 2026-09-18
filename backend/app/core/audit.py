"""
Audit logging helper — phase 3 security hardening.

Records sensitive operations to the activity_logs table with full
context: user, IP, user agent, action, entity, and a JSON-encoded
description.

Use:
    from app.core.audit import audit_log

    @router.delete("/api/v1/customers/{id}")
    def delete_customer(id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(...)):
        # ... do the deletion ...
        audit_log(
            db, request, user,
            action="delete_customer",
            entity_type="customer",
            entity_id=id,
            description="Permanently deleted customer record",
        )
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog
from app.models.user import User


def _client_ip(request: Request | None) -> str | None:
    if not request or not request.client:
        return None
    return request.client.host


def audit_log(
    db: Session,
    request: Request | None,
    user: User | None,
    *,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    description: str | dict[str, Any] | None = None,
) -> None:
    """Persist an audit log entry. Failures here MUST NOT crash the request."""
    try:
        # Encode dicts as JSON strings for portability
        if isinstance(description, dict):
            description_str = json.dumps(description, ensure_ascii=False, default=str)
        else:
            description_str = description

        meta_parts: list[str] = []
        if request is not None:
            ip = _client_ip(request)
            ua = request.headers.get("user-agent")
            if ip:
                meta_parts.append(f"ip={ip}")
            if ua:
                meta_parts.append(f"ua={ua[:120]}")
        meta_suffix = f" [{' | '.join(meta_parts)}]" if meta_parts else ""

        log = ActivityLog(
            user_id=user.id if user else None,
            action=action[:100],
            entity_type=entity_type[:100],
            entity_id=entity_id,
            description=(
                (description_str or "")[:1000]
                + meta_suffix
            ),
        )
        db.add(log)
        db.commit()
    except Exception:
        # Audit failures must never break the primary operation
        try:
            db.rollback()
        except Exception:
            pass
