from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class InvoiceItemManualCreate(BaseModel):
    item_type: str  # "service", "product", "offer"
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    offer_id: Optional[int] = None
    quantity: int = 1
    employee_id: Optional[int] = None
    unit_price: Decimal


class SplitPaymentItem(BaseModel):
    payment_method: str
    amount: Decimal


class InvoiceManualCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_first_name: Optional[str] = None
    customer_last_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_method: str  # "cash", "card", "split", etc.
    split_payments: Optional[List[SplitPaymentItem]] = None
    discount_amount: Decimal = Decimal("0.00")
    appointment_id: Optional[int] = None
    items: List[InvoiceItemManualCreate]


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