from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog


def log_activity(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    description: str | None = None,
    old_values: dict | None = None,
    new_values: dict | None = None,
    **kwargs,
):
    # Build description with old/new values if provided
    full_desc = description or ""
    if old_values is not None or new_values is not None:
        import json

        try:
            extra = json.dumps({"old": old_values, "new": new_values}, ensure_ascii=False)[:1000]
            full_desc = f"{full_desc} | changes: {extra}" if full_desc else f"changes: {extra}"
        except Exception:
            pass
    # Handle legacy kwargs like old_values/new_values passed incorrectly
    if kwargs:
        try:
            import json

            extra = json.dumps(kwargs, ensure_ascii=False)[:500]
            full_desc = f"{full_desc} | extra: {extra}" if full_desc else f"extra: {extra}"
        except Exception:
            pass

    log = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=full_desc,
    )
    db.add(log)
    try:
        db.commit()
    except Exception:
        db.rollback()
        # Fallback: try again without commit, let caller handle
        db.add(log)