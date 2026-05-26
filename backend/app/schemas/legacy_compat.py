from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

# From old models/invoice.py
class InvoiceItemCreateLegacy(BaseModel):
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    barber_id: Optional[int] = None
    price: Decimal
    quantity: int = 1

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class InvoiceCreateLegacy(BaseModel):
    customer_id: int
    items: List[InvoiceItemCreateLegacy]
    discount: Decimal = Field(default=Decimal("0.0"))
    payment_method: str = "CASH"

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class InvoiceResponseLegacy(BaseModel):
    id: int
    invoice_no: str
    total_amount: Decimal
    final_amount: Decimal
    created_at: datetime

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class ServiceResponseLegacy(BaseModel):
    id: int
    name: str
    price: Decimal
    category: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class BarberResponseLegacy(BaseModel):
    id: int
    full_name: str
    specialty: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

# From models/barber.py
class QueueItemLegacy(BaseModel):
    id: int
    customer_name: str
    service: str
    time: str
    status: str # WAITING, IN_PROGRESS, DONE

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class BarberStatsLegacy(BaseModel):
    today_commission: Decimal
    weekly_total: Decimal
    customers_count: int

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class StatusUpdateLegacy(BaseModel):
    status: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )



