from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel, ConfigDict


class InvoiceAdjustmentRequestBase(BaseModel):
    request_type: str
    reason: str
    notes: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None
    requested_values: Optional[Dict[str, Any]] = None


class InvoiceAdjustmentRequestCreate(InvoiceAdjustmentRequestBase):
    pass


class InvoiceAdjustmentRequestRead(InvoiceAdjustmentRequestBase):
    id: int
    invoice_id: int
    requested_by_user_id: int
    approved_by_user_id: Optional[int] = None
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceAdjustmentDecision(BaseModel):
    status: str  # approved, rejected
    decision_note: Optional[str] = None



