from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class WalkInQueueCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_first_name: Optional[str] = Field(default=None, max_length=100)
    customer_last_name: Optional[str] = Field(default=None, max_length=100)
    customer_phone: Optional[str] = Field(default=None, max_length=30)
    customer_email: Optional[str] = None
    service_id: Optional[int] = None
    requested_barber_id: Optional[int] = None
    assigned_barber_id: Optional[int] = None
    queue_note: Optional[str] = None
    estimated_wait_minutes: int = Field(default=0, ge=0)


class WalkInQueueAssign(BaseModel):
    assigned_barber_id: int


class WalkInQueueRead(BaseModel):
    id: int
    customer_id: int
    ticket_no: str
    service_id: Optional[int] = None
    requested_barber_id: Optional[int] = None
    assigned_barber_id: Optional[int] = None
    status: str
    queue_note: Optional[str] = None
    estimated_wait_minutes: int
    arrived_at: datetime
    called_at: Optional[datetime] = None
    service_started_at: Optional[datetime] = None
    converted_session_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    created_at: datetime
    customer_name: Optional[str] = None
    service_name: Optional[str] = None
    assigned_barber_name: Optional[str] = None
    requested_barber_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)



