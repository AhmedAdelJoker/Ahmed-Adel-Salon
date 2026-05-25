from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InventoryAdjustPayload(BaseModel):
    amount: Decimal = Field(..., gt=0)
    note: Optional[str] = None


class InventoryLogRead(BaseModel):
    id: int
    product_id: int
    change_amount: Decimal
    type: str
    note: Optional[str] = None
    created_by_user_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ServiceProductCreate(BaseModel):
    product_id: int
    amount_used: Decimal = Field(..., gt=0)


class ServiceProductRead(BaseModel):
    id: int
    service_id: int
    product_id: int
    amount_used: Decimal

    model_config = ConfigDict(from_attributes=True)