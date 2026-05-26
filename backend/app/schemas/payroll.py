from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

class PayrollBase(BaseModel):
    employee_id: int
    user_id: int | None = None
    employee_name_snapshot: str
    role_snapshot: str | None = None
    period_month: int
    period_year: int
    base_salary: Decimal = Decimal("0.0")
    commission_amount: Decimal = Decimal("0.0")
    bonus_amount: Decimal = Decimal("0.0")
    deduction_amount: Decimal = Decimal("0.0")
    advance_amount: Decimal = Decimal("0.0")
    net_salary: Decimal = Decimal("0.0")
    payment_method: str | None = None
    status: str = "draft"
    notes: str | None = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class PayrollCreate(PayrollBase):
    pass

class PayrollCalculateRequest(BaseModel):
    month: int
    year: int

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

class PayrollUpdate(BaseModel):
    base_salary: Optional[Decimal] = None
    commission_amount: Optional[Decimal] = None
    bonus_amount: Optional[Decimal] = None
    deduction_amount: Optional[Decimal] = None
    advance_amount: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    payment_method: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

class PayrollRead(PayrollBase):
    id: int
    payment_date: Optional[datetime] = None
    expense_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class PayrollSummary(BaseModel):
    month: int
    year: int
    total_base_salary: Decimal
    total_commissions: Decimal
    total_bonuses: Decimal
    total_deductions: Decimal
    total_advances: Decimal
    total_net_salary: Decimal
    paid_total: Decimal
    unpaid_total: Decimal
    employees_count: int

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

class PayrollArchiveResponse(BaseModel):
    items: List[PayrollRead]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )




