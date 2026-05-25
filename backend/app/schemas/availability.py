from datetime import date, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class BarberWorkingHourCreate(BaseModel):
    barber_id: int
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    is_active: bool = True


class BarberWorkingHourRead(BaseModel):
    id: int
    barber_id: int
    day_of_week: int
    start_time: time
    end_time: time
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class BarberTimeOffCreate(BaseModel):
    barber_id: int
    off_date: date
    reason: Optional[str] = None


class BarberTimeOffRead(BaseModel):
    id: int
    barber_id: int
    off_date: date
    reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)