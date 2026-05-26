from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class BusinessSettingsBase(BaseModel):
    salon_name: str = Field(..., min_length=1, max_length=255)
    shop_phone: Optional[str] = Field(default=None, max_length=30)
    shop_whatsapp: Optional[str] = Field(default=None, max_length=30)
    address: Optional[str] = Field(default=None, max_length=500)
    receipt_footer: Optional[str] = None
    currency: str = Field(default="EGP", max_length=10)


class BusinessSettingsCreate(BusinessSettingsBase):
    pass


class BusinessSettingsUpdate(BaseModel):
    salon_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    shop_phone: Optional[str] = Field(default=None, max_length=30)
    shop_whatsapp: Optional[str] = Field(default=None, max_length=30)
    address: Optional[str] = Field(default=None, max_length=500)
    receipt_footer: Optional[str] = None
    currency: Optional[str] = Field(default=None, max_length=10)
    working_hours: Optional[dict[str, Any]] = None


class BusinessSettingsRead(BaseModel):
    id: int
    salon_name: str
    shop_phone: Optional[str] = None
    shop_whatsapp: Optional[str] = None
    address: Optional[str] = None
    receipt_footer: Optional[str] = None
    currency: str = "EGP"
    working_hours: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
