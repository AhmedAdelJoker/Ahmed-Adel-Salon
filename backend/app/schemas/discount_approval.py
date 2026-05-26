from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DiscountApprovalRequestCreate(BaseModel):
    invoice_id: int
    requested_discount_amount: Decimal = Field(..., ge=0)
    reason: Optional[str] = None


class DiscountApprovalDecision(BaseModel):
    decision_note: Optional[str] = None


class DiscountApprovalRequestRead(BaseModel):
    id: int
    invoice_id: int
    requested_by_user_id: int
    requested_discount_amount: Decimal
    reason: Optional[str] = None
    status: str
    decision_note: Optional[str] = None
    approved_by_user_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    invoice_no: Optional[str] = None
    requested_by_name: Optional[str] = None
    approved_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)



