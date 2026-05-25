from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field


class AppointmentServiceItemCreate(BaseModel):
    service_id: int
    quantity: int = Field(default=1, ge=1)


class AppointmentServiceItemRead(BaseModel):
    id: int
    appointment_id: int
    service_id: Optional[int] = None
    service_name_snapshot: str
    price_snapshot: Decimal
    duration_snapshot_minutes: int
    quantity: int
    is_active: bool
    is_changed: bool
    change_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AppointmentCreate(BaseModel):
    customer_id: int
    barber_id: int
    appointment_date: date
    appointment_time: time
    notes: Optional[str] = None
    services: List[AppointmentServiceItemCreate]


class AppointmentUpdate(BaseModel):
    customer_id: int
    barber_id: int
    appointment_date: date
    appointment_time: time
    notes: Optional[str] = None
    services: List[AppointmentServiceItemCreate]


class AppointmentMovePayload(BaseModel):
    barber_id: Optional[int] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[time] = None
    status: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    status: str


class AppointmentRead(BaseModel):
    id: int
    customer_id: int
    barber_id: int
    appointment_date: date
    appointment_time: time
    status: str
    notes: Optional[str] = None
    total_estimated_price: Decimal
    total_estimated_duration_minutes: int
    confirmation_sent: bool
    reminder_24h_sent: bool
    reminder_2h_sent: bool
    created_at: datetime
    updated_at: datetime

    customer_name: Optional[str] = None
    barber_name: Optional[str] = None

    services: List[AppointmentServiceItemRead] = []

    model_config = ConfigDict(from_attributes=True)
