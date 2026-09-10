from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    booking_source: Optional[str] = "shop"
    services: List[AppointmentServiceItemCreate]

    @field_validator("appointment_time", mode="before")
    @classmethod
    def parse_time(cls, v):
        if isinstance(v, str):
            if len(v) == 5: # HH:MM
                return f"{v}:00"
        return v

class AppointmentUpdate(BaseModel):
    customer_id: int
    barber_id: int
    appointment_date: date
    appointment_time: time
    notes: Optional[str] = None
    booking_source: Optional[str] = "shop"
    services: List[AppointmentServiceItemCreate]

    @field_validator("appointment_time", mode="before")
    @classmethod
    def parse_time(cls, v):
        if isinstance(v, str):
            if len(v) == 5: # HH:MM
                return f"{v}:00"
        return v


class AppointmentMovePayload(BaseModel):
    barber_id: Optional[int] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[time] = None
    status: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    status: str
    cancellation_reason: Optional[str] = None


class AppointmentAssignBarberPayload(BaseModel):
    employee_id: int


class AppointmentFastWalkinCreate(BaseModel):
    phone: Optional[str] = Field(None, min_length=5, max_length=30)
    first_name: Optional[str] = Field(None, max_length=100)
    customer_id: Optional[int] = None
    service_id: Optional[int] = None
    service_ids: Optional[List[int]] = None
    employee_id: Optional[int] = None
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None
    notes: Optional[str] = None
    booking_source: Optional[str] = "shop"


class AppointmentRead(BaseModel):
    id: int
    customer_id: int
    barber_id: int
    appointment_date: date
    appointment_time: time
    status: str
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    booking_source: Optional[str] = "shop"
    total_estimated_price: Decimal
    total_estimated_duration_minutes: int
    confirmation_sent: bool
    reminder_24h_sent: bool
    reminder_2h_sent: bool
    created_at: datetime
    updated_at: datetime

    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    barber_name: Optional[str] = None

    services: List[AppointmentServiceItemRead] = []

    model_config = ConfigDict(from_attributes=True)


class BarberAppointmentStats(BaseModel):
    total: int = 0
    in_progress: int = 0
    ready_for_payment: int = 0
    completed: int = 0
    cancelled: int = 0
    invoiced: int = 0


class BarberAppointmentsResponse(BaseModel):
    employee_id: Optional[int] = None
    employee_name: str
    barber: Optional[dict] = None
    appointments: List[AppointmentRead] = []
    stats: BarberAppointmentStats
