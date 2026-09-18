from datetime import datetime
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, Response
from sqlalchemy.orm import Session
from typing import Dict, List, Optional

from app.db.session import get_db
from app.api.deps import require_any_staff
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification_simple import NotificationRead

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def broadcast(self, message: dict):
        for user_id, connections in list(self.active_connections.items()):
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()


@router.get("", response_model=list[NotificationRead])
def get_notifications(
    response: Response = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    unread_only: bool = False,
    sort: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    # Phase 2: legacy skip/limit takes priority if explicitly larger than 0
    eff_offset = (page - 1) * page_size
    eff_limit = page_size
    if skip > 0 or limit != 100:
        eff_offset = skip
        eff_limit = limit

    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )
    if unread_only:
        query = query.filter(Notification.is_read == False)

    # Phase 2: optional sort
    if sort:
        sort_field = sort.lstrip("-")
        desc = sort.startswith("-")
        column = getattr(Notification, sort_field, None)
        if column is not None:
            query = query.order_by(column.desc() if desc else column.asc())
    else:
        query = query.order_by(Notification.id.desc())

    # Phase 2: count + headers
    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        response.headers["X-Page"] = str(page)
    return query.offset(eff_offset).limit(eff_limit).all()


@router.patch("/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_role == current_user.role).first()
    if not row:
        return {"message": "الإشعار غير موجود"}
    row.is_read = True
    db.commit()
    return {"message": "تم تحديث الإشعار"}


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            target_id = data.get("targetId")
            message_text = data.get("message")
            if target_id and message_text:
                payload = {
                    "id": 0,
                    "title": "إشعار جديد",
                    "message": message_text,
                    "is_read": False,
                    "created_at": datetime.now().isoformat()
                }
                await manager.send_personal_message(payload, int(target_id))
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)

