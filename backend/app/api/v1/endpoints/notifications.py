from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from sqlalchemy.orm import Session

from app.api.deps import require_any_staff
from app.api.deps_auth import authenticate_access_token
from app.core.config import settings
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification_simple import NotificationRead
from app.services.websocket import manager

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _websocket_token(websocket: WebSocket) -> str | None:
    raw_protocols = websocket.headers.get("sec-websocket-protocol", "")
    protocols = [item.strip() for item in raw_protocols.split(",") if item.strip()]
    if len(protocols) >= 2 and protocols[0] == "access-token":
        return protocols[1]
    return None


def _origin_allowed(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin or origin == "null" or origin.startswith("file://"):
        return True
    configured = settings.BACKEND_CORS_ORIGINS
    if isinstance(configured, str):
        allowed = {item.strip().rstrip("/") for item in configured.split(",")}
    else:
        allowed = {str(item).strip().rstrip("/") for item in configured}
    allowed.update(
        {
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        }
    )
    return origin.rstrip("/") in allowed


@router.get("", response_model=List[NotificationRead])
def get_notifications(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    unread_only: bool = False,
    sort: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    effective_offset = (page - 1) * page_size
    effective_limit = page_size
    if skip > 0 or limit != 100:
        effective_offset = skip
        effective_limit = limit

    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))

    if sort:
        sort_field = sort.lstrip("-")
        column = getattr(Notification, sort_field, None)
        if column is not None:
            query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
    else:
        query = query.order_by(Notification.id.desc())

    total = query.count()
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page-Size"] = str(effective_limit)
    response.headers["X-Page"] = str(page)
    return query.offset(effective_offset).limit(effective_limit).all()


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    row = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="الإشعار غير موجود")
    row.is_read = True
    db.commit()
    return {"message": "تم تحديث الإشعار"}


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    db: Session = Depends(get_db),
):
    if not _origin_allowed(websocket):
        await websocket.close(code=4403)
        return

    token = _websocket_token(websocket)
    if not token:
        await websocket.close(code=4401)
        return

    try:
        current_user = authenticate_access_token(db, token)
    except HTTPException:
        await websocket.close(code=4401)
        return

    if current_user.id != user_id or not current_user.is_active:
        await websocket.close(code=4403)
        return

    await manager.connect(websocket, current_user.id, subprotocol="access-token")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user.id)
    except Exception:
        manager.disconnect(websocket, current_user.id)
