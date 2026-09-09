from fastapi.middleware.cors import CORSMiddleware
from decimal import Decimal
from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field, model_validator, AliasPath
from pydantic.alias_generators import to_camel
from pydantic import AliasChoices

# Helper to accept both snake_case and camelCase
def _camel_alias(field_name: str) -> str:
    return to_camel(field_name)

class EmployeeBase(BaseModel):
    full_name: str
    display_name: Optional[str] = None
    phone_primary: str
    phone_secondary: Optional[str] = None
    profile_image_url: Optional[str] = None
    national_id: Optional[str] = None
    birth_date: Optional[datetime] = None
    governorate: Optional[str] = None
    city: Optional[str] = None
    detailed_address: Optional[str] = None
    personal_notes: Optional[str] = None
    bio_ar: Optional[str] = None
    bio_en: Optional[str] = None

    job_title: str = "barber"
    department: Optional[str] = None
    employment_type: str = "full_time"
    hire_date: Optional[datetime] = None
    status: str = "active"
    work_days_json: Optional[List[int]] = None
    work_hours_json: Optional[Any] = None
    
    show_in_pos: bool = True
    show_in_booking: bool = True
    display_order: int = 0
    is_active: bool = True

    base_salary: Decimal = Decimal("0.00")
    commission_rate: Decimal = Decimal("0.00")
    fixed_bonus: Decimal = Decimal("0.00")
    bonus_min_attendance_percent: Decimal = Decimal("0.00")
    enable_attendance_auto_deduction: bool = True
    discipline_bonus: Decimal = Decimal("0.00")
    default_deductions: Decimal = Decimal("0.00")
    payment_method: Optional[str] = None
    wallet_number: Optional[str] = None
    bank_account: Optional[str] = None

    assistant_of_barber_id: Optional[int] = None
    assistant_tasks_json: Optional[List[str]] = None
    receives_commission: bool = False
    assistant_commission_rate: Decimal = Decimal("0.00")

    has_login_account: bool = False
    user_id: Optional[int] = None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
        extra="ignore",
    )

class EmployeeCreate(EmployeeBase):
    # Allow both camelCase and snake_case on creation
    # Extended fields for optional login creation (handled in endpoint, not stored in employees table directly beyond has_login_account/user_id)
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    service_ids: Optional[List[int]] = Field(default=None, alias="serviceIds")  # allow frontend serviceIds
    # also accept serviceIds snake
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
        extra="ignore",
    )

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    phone_primary: Optional[str] = None
    phone_secondary: Optional[str] = None
    profile_image_url: Optional[str] = None
    national_id: Optional[str] = None
    birth_date: Optional[datetime] = None
    governorate: Optional[str] = None
    city: Optional[str] = None
    detailed_address: Optional[str] = None
    personal_notes: Optional[str] = None
    bio_ar: Optional[str] = None
    bio_en: Optional[str] = None

    job_title: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    hire_date: Optional[datetime] = None
    status: Optional[str] = None
    work_days_json: Optional[List[int]] = None
    work_hours_json: Optional[Any] = None
    
    show_in_pos: Optional[bool] = None
    show_in_booking: Optional[bool] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

    base_salary: Optional[Decimal] = None
    commission_rate: Optional[Decimal] = None
    fixed_bonus: Optional[Decimal] = None
    bonus_min_attendance_percent: Optional[Decimal] = None
    enable_attendance_auto_deduction: Optional[bool] = None
    discipline_bonus: Optional[Decimal] = None
    default_deductions: Optional[Decimal] = None
    payment_method: Optional[str] = None
    wallet_number: Optional[str] = None
    bank_account: Optional[str] = None

    assistant_of_barber_id: Optional[int] = None
    assistant_tasks_json: Optional[List[str]] = None
    receives_commission: Optional[bool] = None
    assistant_commission_rate: Optional[Decimal] = None

    has_login_account: Optional[bool] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    service_ids: Optional[List[int]] = Field(default=None, alias="serviceIds")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
        extra="ignore",
    )

from app.schemas.service import ServiceRead

class EmployeeRead(EmployeeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    # Computed or linked fields
    assistant_of_name: Optional[str] = None
    services: List[ServiceRead] = []

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
        extra="ignore",
    )

class EmployeeListItem(BaseModel):
    id: int
    full_name: str
    display_name: Optional[str] = None
    job_title: str
    phone_primary: str
    status: str
    is_active: bool
    base_salary: Decimal
    commission_rate: Decimal
    assistant_of_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    service_ids: List[int] = []

    model_config = ConfigDict(
        from_attributes=True
    )



