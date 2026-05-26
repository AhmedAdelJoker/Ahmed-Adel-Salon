from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

class EmployeeBase(BaseModel):
    full_name: str
    username: str
    role: str # OWNER, MANAGER, CASHIER, BARBER
    status: str = "ACTIVE" # ACTIVE, SUSPENDED, ON_LEAVE, TERMINATED
    phone: str | None = None
    address: str | None = None
    image: str | None = None
    private_notes: str | None = None
    specialty: str | None = None
    base_salary: Decimal = Decimal("0.0")
    commission_rate: Decimal = Decimal("0.0")
    hire_date: datetime | None = None
    notes: str | None = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class EmployeeCreate(EmployeeBase):
    password: str

class EmployeeUpdate(EmployeeBase):
    password: Optional[str] = None
    is_active: Optional[bool] = None

class EmployeePerformance(BaseModel):
    total_clients: int = 0
    total_services: int = 0
    total_revenue: Decimal = Decimal("0.0")
    avg_invoice_value: Decimal = Decimal("0.0")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class EmployeeResponse(EmployeeBase):
    id: int
    is_active: bool
    is_deleted: bool
    created_at: datetime
    performance: Optional[EmployeePerformance] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class ActivityLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    details: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class ReportSummary(BaseModel):
    total_revenue: Decimal
    total_expenses: Decimal
    net_profit: Decimal
    daily_stats: List[dict] # {date: str, revenue: float}

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )



