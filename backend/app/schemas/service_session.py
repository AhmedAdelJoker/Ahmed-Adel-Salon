from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    appointment_id: Optional[int] = None
    customer_id: int
    barber_id: int
    notes: Optional[str] = None


class SessionStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=30)


class SessionProductRead(BaseModel):
    id: int
    session_id: int
    product_id: int
    quantity_used: Decimal

    model_config = ConfigDict(from_attributes=True)


class ServiceSessionRead(BaseModel):
    id: int
    appointment_id: Optional[int] = None
    customer_id: int
    barber_id: int
    status: str
    notes: Optional[str] = None
    total_price: Decimal
    created_by_user_id: Optional[int] = None
    created_at: datetime

    customer_name: Optional[str] = None
    barber_name: Optional[str] = None
    products: list[SessionProductRead] = []

    model_config = ConfigDict(from_attributes=True)