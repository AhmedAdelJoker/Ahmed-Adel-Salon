from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

class SalaryAdvanceBase(BaseModel):
    employee_id: int
    amount: Decimal
    description: Optional[str] = None
    advance_date: Optional[datetime] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class SalaryAdvanceCreate(SalaryAdvanceBase):
    pass

class SalaryAdvanceUpdate(BaseModel):
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    advance_date: Optional[datetime] = None
    is_deducted: Optional[bool] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

class SalaryAdvanceRead(SalaryAdvanceBase):
    id: int
    is_deducted: bool
    payroll_record_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    employee_name: Optional[str] = None # For UI convenience

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )



