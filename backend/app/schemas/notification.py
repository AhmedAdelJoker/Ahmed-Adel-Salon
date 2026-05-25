from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationUpdateRead(BaseModel):
    is_read: bool


# alias للتوافق مع أي كود قديم
NotificationUpdateReadStatus = NotificationUpdateRead


class NotificationRead(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedNotificationsRead(BaseModel):
    items: list[NotificationRead] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 1