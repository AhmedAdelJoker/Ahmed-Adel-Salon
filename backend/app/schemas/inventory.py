from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InventoryAdjustPayload(BaseModel):
    amount: Decimal = Field(..., gt=0)
    note: Optional[str] = None


class InventoryAddStockPayload(InventoryAdjustPayload):
    create_expense: bool = True
    purchase_price: Optional[Decimal] = Field(default=None, ge=0)
    invoice_image_url: Optional[str] = None


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
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    product_quantity: Optional[Decimal] = None
    product_cost_price: Optional[Decimal] = None
    product_weight: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)
