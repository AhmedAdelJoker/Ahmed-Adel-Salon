from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class InvoiceItemManualCreate(BaseModel):
    item_type: Literal["service", "product", "offer"]
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    offer_id: Optional[int] = None
    quantity: int = Field(default=1, gt=0)
    employee_id: Optional[int] = None
    unit_price: Optional[Decimal] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_reference(self):
        reference_fields = {
            "service": "service_id",
            "product": "product_id",
            "offer": "offer_id",
        }
        expected_field = reference_fields[self.item_type]
        if getattr(self, expected_field) is None:
            raise ValueError(f"مرجع {self.item_type} مطلوب")
        if any(
            getattr(self, field) is not None
            for field in reference_fields.values()
            if field != expected_field
        ):
            raise ValueError("يجب إرسال مرجع واحد فقط sesuai نوع البند")
        return self


class SplitPaymentItem(BaseModel):
    payment_method: Literal["cash", "card", "bank_transfer", "wallet"]
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class InvoiceManualCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_first_name: Optional[str] = None
    customer_last_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_method: Literal["cash", "card", "bank_transfer", "wallet", "split"]
    split_payments: Optional[List[SplitPaymentItem]] = Field(default=None, min_length=1)
    discount_amount: Decimal = Field(
        default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2
    )
    appointment_id: Optional[int] = None
    items: List[InvoiceItemManualCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_split_payments(self):
        if self.payment_method == "split" and not self.split_payments:
            raise ValueError("الدفع المقسوم يتطلب قسمة الدفع")
        if self.payment_method != "split" and self.split_payments:
            raise ValueError("قسمة الدفع متاحة فقط مع payment_method=split")
        return self


class InvoiceItemRead(BaseModel):
    id: int
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    offer_id: Optional[int] = None
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
    customer_name: Optional[str] = None
    barber_name: Optional[str] = None
    payment_method: str
    subtotal_amount: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")
    total_amount: Decimal
    pdf_path: Optional[str] = None
    created_at: datetime

    items: List[InvoiceItemRead] = []

    model_config = ConfigDict(from_attributes=True)


class IssueInvoiceResponse(BaseModel):
    message: str
    invoice_id: int
    invoice_no: str