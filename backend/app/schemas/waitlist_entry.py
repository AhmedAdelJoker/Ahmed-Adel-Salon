from datetime import date, time, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class WaitlistEntryCreate(BaseModel):
    customer_id: int
    barber_id: Optional[int] = None
    preferred_date: date
    preferred_time_start: Optional[time] = None
    preferred_time_end: Optional[time] = None
    service_ids: Optional[List[int]] = None
    notes: Optional[str] = None
    priority: int = 0


class WaitlistEntryRead(BaseModel):
    id: int
    customer_id: int
    barber_id: Optional[int] = None
    preferred_date: date
    preferred_time_start: Optional[time] = None
    preferred_time_end: Optional[time] = None
    service_ids: Optional[str] = None
    notes: Optional[str] = None
    status: str
    priority: int
    notification_sent: bool
    notification_sent_at: Optional[datetime] = None
    converted_to_appointment_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    barber_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WaitlistEntryUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[int] = None
    notes: Optional[str] = None
    barber_id: Optional[int] = None
