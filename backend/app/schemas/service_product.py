from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from .product import ProductRead

class ServiceProductBase(BaseModel):
    product_id: int
    amount_used: Decimal = Field(..., ge=0)

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

class ServiceProductCreate(ServiceProductBase):
    pass

class ServiceProductRead(ServiceProductBase):
    id: int
    product: Optional["ProductRead"] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

from typing import Optional
