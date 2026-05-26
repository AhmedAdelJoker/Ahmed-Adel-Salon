from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class InvoicePaymentBase(BaseModel):
    payment_method: str = Field(default="cash", max_length=30)
    amount: Decimal = Field(..., ge=0)
    reference_no: str | None = Field(None, max_length=100)
    external_channel: str | None = Field(None, max_length=100)


class InvoicePaymentCreate(InvoicePaymentBase):
    invoice_id: int


class InvoicePaymentRead(InvoicePaymentBase):
    id: int
    invoice_id: int
    shift_id: int | None = None
    received_by_user_id: int | None
    received_at: datetime

    model_config = ConfigDict(from_attributes=True)



