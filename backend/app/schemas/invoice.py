from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class InvoiceItemRead(BaseModel):
    id: int
    service_id: Optional[int] = None
    service_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal

    model_config = ConfigDict(from_attributes=True)


class InvoiceRead(BaseModel):
    id: int
    invoice_no: str
    appointment_id: Optional[int] = None
    customer_id: int
    barber_id: Optional[int] = None
    payment_method: str
    total_amount: Decimal
    pdf_path: Optional[str] = None
    created_at: datetime

    items: List[InvoiceItemRead] = []

    model_config = ConfigDict(from_attributes=True)


class IssueInvoiceResponse(BaseModel):
    message: str
    invoice_id: int
    invoice_no: str