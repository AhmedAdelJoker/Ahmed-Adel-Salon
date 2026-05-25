from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ActivityLogRead(BaseModel):
    id: int
    action: str
    entity_type: str | None = None
    entity_id: int | None = None
    description: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedActivityLogsRead(BaseModel):
    items: list[ActivityLogRead] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 1