from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ServiceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0)
    duration_minutes: int = Field(default=30, ge=1)
    is_active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(ServiceBase):
    pass


class ServiceRead(BaseModel):
    id: int
    name: str
    price: Decimal
    duration_minutes: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)