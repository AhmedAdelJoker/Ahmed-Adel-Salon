from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CustomerBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(default="", min_length=0, max_length=100)
    phone: str = Field(..., min_length=5, max_length=30)
    email: Optional[str] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    pass


class CustomerRead(BaseModel):
    customer_id: int
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None
    
    # Loyalty Fields
    loyalty_points: Decimal = Decimal("0.0")
    lifetime_spend: Decimal = Decimal("0.0")
    visits_count: int = 0
    current_tier: str = "Bronze"
    cancellation_count: int = 0
    
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserBrief(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CustomerArchiveRead(CustomerRead):
    """Customer read model for archived customers - includes deletion metadata"""
    is_deleted: bool = True
    deleted_at: Optional[datetime] = None
    deleted_by_user_id: Optional[int] = None
    archive_reason: Optional[str] = None
    deleted_by: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerSearchRead(CustomerRead):
    last_employee_name: Optional[str] = None
    visits_count: int = 0
