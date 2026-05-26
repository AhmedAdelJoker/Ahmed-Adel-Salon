from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ServiceCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    name_ar: Optional[str] = Field(default=None, max_length=255)
    icon: Optional[str] = Field(default=None, max_length=100)
    sort_order: int = 0
    is_active: bool = True


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryUpdate(ServiceCategoryBase):
    pass


class ServiceCategoryRead(ServiceCategoryBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
