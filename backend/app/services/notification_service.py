from math import ceil
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User


def create_notification(
    db: Session,
    *,
    user_id: int,
    title: str,
    message: str,
    type: str = "info",
):
    item = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        is_read=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_notifications(
    db: Session,
    user: User,
    page: int = 1,
    page_size: int = 10,
    unread_only: bool = False,
):
    query = db.query(Notification).filter(Notification.user_id == user.id)

    if unread_only:
        query = query.filter(Notification.is_read.is_(False))

    total = query.count()
    total_pages = max(ceil(total / page_size), 1)
    page = max(min(page, total_pages), 1)

    rows = (
        query.order_by(Notification.id.desc())
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


def mark_notification_read(db: Session, item: Notification, is_read: bool):
    item.is_read = is_read
    db.commit()
    db.refresh(item)
    return item


def mark_all_notifications_read(db: Session, user: User):
    (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
