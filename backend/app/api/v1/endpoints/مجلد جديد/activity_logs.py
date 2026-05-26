from fastapi.middleware.cors import CORSMiddleware
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.schemas.activity_log import PaginatedActivityLogsRead
from app.services.activity_log_service import list_activity_logs

router = APIRouter(prefix="/activity-logs", tags=["Activity Logs"])


from sqlalchemy.orm import joinedload

@router.get("", response_model=PaginatedActivityLogsRead)
def get_activity_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=200),
    action: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER)),
):
    # Pass extra options to query if needed, but list_activity_logs handles the query
    data = list_activity_logs(
        db,
        skip=skip,
        limit=limit,
        action=action,
        entity_type=entity_type,
        user_id=user_id,
        q=q,
        start_date=start_date,
        end_date=end_date,
    )

    return {
        "items": [
            {
                "id": row.id,
                "user_id": row.user_id,
                "user_name": row.user.full_name if row.user else None,
                "action": row.action,
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "description": row.description,
                "old_values_json": row.old_values_json,
                "new_values_json": row.new_values_json,
                "ip_address": row.ip_address,
                "device_label": row.device_label,
                "created_at": row.created_at,
            }
            for row in data["items"]
        ],
        "total": data["total"],
        "skip": skip,
        "limit": limit,
    }



