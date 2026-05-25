from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_any_staff
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification_simple import NotificationRead

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=list[NotificationRead])
def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    return db.query(Notification).filter(Notification.user_role == current_user.role).order_by(Notification.id.desc()).all()

@router.patch("/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_any_staff)):
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_role == current_user.role).first()
    if not row:
        return {"message": "الإشعار غير موجود"}
    row.is_read = True
    db.commit()
    return {"message": "تم تحديث الإشعار"}
