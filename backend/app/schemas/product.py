from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=255)
    sku: Optional[str] = Field(default=None, max_length=100)
    company_name: Optional[str] = Field(default=None, max_length=255)
    unit: str = Field(default="g", max_length=50)
    cost_price: Decimal = Field(default=0, ge=0)
    sell_price: Optional[Decimal] = Field(default=None, ge=0)
    min_quantity_alert: Decimal = Field(default=0, ge=0)
    weight: Optional[Decimal] = Field(default=None, ge=0)
    image_url: Optional[str] = None
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    pass


class ProductRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    sku: Optional[str] = None
    company_name: Optional[str] = None
    quantity: Decimal
    unit: str
    cost_price: Decimal
    sell_price: Optional[Decimal] = None
    min_quantity_alert: Decimal
    weight: Optional[Decimal] = None
    image_url: Optional[str] = None
    is_active: bool
    is_archived: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
