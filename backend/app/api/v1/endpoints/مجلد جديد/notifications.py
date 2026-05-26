from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_any_staff
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification_simple import NotificationRead
from app.services.websocket import manager

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep the connection alive and wait for messages if needed
            data = await websocket.receive_json()
            # Handle incoming messages from client if any
            print(f"Received message from user {user_id}: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        print(f"User {user_id} disconnected")
    except Exception as e:
        print(f"Error in websocket for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)


@router.get("", response_model=list[NotificationRead])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    return (
        db.query(Notification)
        .filter(
            or_(
                Notification.user_id == current_user.id,
                Notification.user_role == current_user.role,
            )
        )
        .order_by(Notification.id.desc())
        .all()
    )


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
            or_(
                Notification.user_id == current_user.id,
                Notification.user_role == current_user.role,
            ),
        )
        .first()
    )
    if not row:
        return {"message": "Notification not found"}
    row.is_read = True
    db.commit()
    return {"message": "Notification updated"}



