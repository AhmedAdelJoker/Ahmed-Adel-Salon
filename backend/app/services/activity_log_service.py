from math import ceil
from datetime import datetime, time
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog


def log_activity(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    description: str | None = None,
):
    item = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_activity_logs(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    action: str | None = None,
    entity_type: str | None = None,
    user_id: int | None = None,
    search: str | None = None,
    start_date=None,
    end_date=None,
):
    query = db.query(ActivityLog)

    if action:
        query = query.filter(ActivityLog.action == action)

    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)

    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)

    if start_date:
        query = query.filter(ActivityLog.created_at >= datetime.combine(start_date, time.min))

    if end_date:
        query = query.filter(ActivityLog.created_at <= datetime.combine(end_date, time.max))

    if search:
        value = f"%{search}%"
        query = query.filter(
            or_(
                ActivityLog.action.ilike(value),
                ActivityLog.entity_type.ilike(value),
                ActivityLog.entity_id.ilike(value),
                ActivityLog.description.ilike(value),
            )
        )

    total = query.count()
    total_pages = max(ceil(total / page_size), 1)
    page = max(min(page, total_pages), 1)

    rows = (
        query.order_by(ActivityLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }