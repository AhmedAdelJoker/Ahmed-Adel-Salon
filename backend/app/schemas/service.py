from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.inventory import ServiceProductCreate, ServiceProductRead


class ServiceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    name_ar: Optional[str] = Field(default=None, max_length=255)
    name_en: Optional[str] = Field(default=None, max_length=255)
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=500)
    category: Optional[str] = Field(default=None, max_length=255)
    category_id: Optional[int] = None
    price: Decimal = Field(..., ge=0)
    duration_minutes: int = Field(default=30, ge=1)
    is_active: bool = True
    ingredients: list[ServiceProductCreate] = []


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(ServiceBase):
    pass


class ServiceRead(BaseModel):
    id: int
    name: str
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    price: Decimal
    duration_minutes: int
    is_active: bool
    created_at: datetime
    ingredients: list[ServiceProductRead] = []

    model_config = ConfigDict(from_attributes=True)
