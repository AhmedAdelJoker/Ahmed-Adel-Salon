from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class OfferServiceRead(BaseModel):
    id: int
    name: str
    price: Decimal


class OfferBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    name_ar: Optional[str] = Field(default=None, max_length=255)
    name_en: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=500)
    original_price: Optional[Decimal] = Field(default=None, ge=0)
    offer_price: Decimal = Field(..., ge=0)
    discount_percentage: Optional[Decimal] = Field(default=None, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_public: bool = True
    is_active: bool = True
    service_ids: list[int] = []


class OfferCreate(OfferBase):
    pass


class OfferUpdate(OfferBase):
    pass


class OfferRead(BaseModel):
    id: int
    name: str
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    image_url: Optional[str] = None
    original_price: Optional[Decimal] = None
    offer_price: Decimal
    discount_percentage: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_public: bool
    is_active: bool
    created_at: datetime
    services: list[OfferServiceRead] = []

    model_config = ConfigDict(from_attributes=True)
