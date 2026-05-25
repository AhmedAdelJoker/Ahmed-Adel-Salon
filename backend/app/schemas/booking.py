from datetime import date, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class PublicBookingServiceItem(BaseModel):
    service_id: int
    quantity: int = Field(default=1, ge=1)


class PublicBookingCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=5, max_length=30)
    email: Optional[EmailStr] = None

    barber_id: int
    appointment_date: date
    appointment_time: time
    notes: Optional[str] = Field(default=None, max_length=1000)

    services: List[PublicBookingServiceItem]

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        sanitized = "".join(char for char in value if char.isdigit() or char == "+").strip()
        if len(sanitized) < 5:
            raise ValueError("رقم الهاتف غير صالح")
        return sanitized


class PublicBookingResponse(BaseModel):
    message: str
    appointment_id: int
    customer_id: int

    model_config = ConfigDict(from_attributes=True)
