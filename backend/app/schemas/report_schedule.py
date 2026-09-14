from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


VALID_FREQUENCIES = ("daily", "weekly", "monthly")
VALID_CHANNELS = ("notification", "whatsapp", "both")


class ReportScheduleCreate(BaseModel):
    name: Optional[str] = Field(default="التقرير المالي الدوري", max_length=255)
    frequency: str = Field(default="daily", max_length=20)
    channel: str = Field(default="notification", max_length=20)
    target_phone: Optional[str] = Field(default=None, max_length=30)
    is_active: bool = True


class ReportScheduleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    frequency: Optional[str] = Field(default=None, max_length=20)
    channel: Optional[str] = Field(default=None, max_length=20)
    target_phone: Optional[str] = Field(default=None, max_length=30)
    is_active: Optional[bool] = None


class ReportScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    frequency: str
    channel: str
    target_phone: Optional[str] = None
    is_active: bool
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    last_status: str = "never"
    last_summary: Optional[str] = None
    last_pdf_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
