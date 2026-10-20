from fastapi.middleware.cors import CORSMiddleware
from decimal import Decimal
from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator, AliasPath
from pydantic.alias_generators import to_camel
from pydantic import AliasChoices

from app.core import employee_rules

# Helper to accept both snake_case and camelCase
def _camel_alias(field_name: str) -> str:
    return to_camel(field_name)

class EmployeeBase(BaseModel):
    full_name: str
    display_name: Optional[str] = None
    phone_primary: str
    phone_secondary: Optional[str] = None
    email: Optional[str] = None
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
    contract_end_date: Optional[date] = None
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

    @field_validator("email", "contract_end_date", mode="before")
    @classmethod
    def blank_optional_fields_are_absent(cls, value):
        """An untouched optional field arrives as `""` from the form, not `null`.

        Without this, clearing an address in the UI is a 422 ("input is too
        short" from the date parser) and there is no way to remove a value once
        typed — the owner can add one but never take it back off a record.
        """
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @field_validator("email")
    @classmethod
    def email_must_be_an_address(cls, value):
        """An address that cannot be delivered to is worse than none: it reads as
        contact info and then quietly fails the first time someone uses it.

        Checked only when a value is present, and deliberately not unique across
        employees — shared family and staff addresses are common, and `phone` is
        the field that identifies a person.
        """
        if value is None:
            return None
        text = str(value).strip()
        local, _, domain = text.partition("@")
        if (
            text.count("@") != 1
            or not local
            or not domain
            or "." not in domain
            or any(c.isspace() for c in text)
            or domain.startswith(".")
            or domain.endswith(".")
        ):
            raise ValueError("البريد الإلكتروني غير صالح")
        return text

    @model_validator(mode="after")
    def contract_cannot_end_before_the_hire_date(self):
        """A contract that ended before the person started is a typo, and it is
        the kind that quietly excludes them from renewal reminders forever."""
        if self.contract_end_date and self.hire_date:
            hired = (
                self.hire_date.date()
                if isinstance(self.hire_date, datetime)
                else self.hire_date
            )
            if self.contract_end_date < hired:
                raise ValueError("تاريخ انتهاء العقد لا يمكن أن يسبق تاريخ التعيين")
        return self

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

    # ── Identity rules ───────────────────────────────────────────────────────
    #
    # Deliberately on Create/Update and not on `EmployeeBase`: the base is also
    # the read model, and a legacy row that predates these rules must still be
    # readable instead of making the whole roster a 500. Writes are gated; reads
    # stay honest about what is actually stored.
    #
    # Values are normalized as they arrive — an Arabic keyboard's ٠١٠… is the
    # same number as 010… , and whichever form was typed, one canonical form is
    # stored — then validated with the same rules and Arabic messages as the
    # wizard (`frontend/src/features/hr/utils`).

    @field_validator("full_name", mode="before")
    @classmethod
    def full_name_is_a_name(cls, value):
        if value is None:
            return None
        error = employee_rules.person_name_error(value)
        if error:
            raise ValueError(error)
        return employee_rules.normalize_person_name(value)

    @field_validator("phone_primary", mode="before")
    @classmethod
    def phone_primary_is_dialable(cls, value):
        error = employee_rules.phone_error(value)
        if error:
            raise ValueError(error)
        return employee_rules.normalize_phone(value)

    @field_validator("phone_secondary", "wallet_number", mode="before")
    @classmethod
    def optional_phones_are_dialable(cls, value):
        if value is None or str(value).strip() == "":
            return None
        error = employee_rules.phone_error(value)
        if error:
            raise ValueError(error)
        return employee_rules.normalize_phone(value)

    @field_validator("national_id", mode="before")
    @classmethod
    def national_id_is_real(cls, value):
        if value is None or str(value).strip() == "":
            return None
        error = employee_rules.national_id_error(value)
        if error:
            raise ValueError(error)
        return employee_rules.digits_only(value)

    @field_validator("bank_account", mode="before")
    @classmethod
    def bank_account_is_shaped(cls, value):
        if value is None or str(value).strip() == "":
            return None
        error = employee_rules.bank_account_error(value)
        if error:
            raise ValueError(error)
        return str(value).strip()

    @field_validator(
        "base_salary",
        "fixed_bonus",
        "discipline_bonus",
        "default_deductions",
        mode="before",
    )
    @classmethod
    def amounts_are_sane(cls, value):
        error = employee_rules.money_error(value, "المبلغ")
        if error:
            raise ValueError(error)
        return value

    @field_validator(
        "commission_rate",
        "assistant_commission_rate",
        "bonus_min_attendance_percent",
        mode="before",
    )
    @classmethod
    def percents_are_sane(cls, value):
        error = employee_rules.percent_error(value)
        if error:
            raise ValueError(error)
        return value

    @field_validator("username", mode="before")
    @classmethod
    def username_is_shaped(cls, value):
        if value is None or str(value).strip() == "":
            return value  # required-ness is the endpoint's decision
        error = employee_rules.username_error(value)
        if error:
            raise ValueError(error)
        return str(value).strip()

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    phone_primary: Optional[str] = None
    phone_secondary: Optional[str] = None
    email: Optional[str] = None
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
    contract_end_date: Optional[date] = None
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

    # Same rules as `EmployeeBase`. Without them here, an edit could clear the
    # address but not the date, and a partial update of one employee would accept
    # values the create path rejects.
    _blank_is_absent = field_validator("email", "contract_end_date", mode="before")(
        EmployeeBase.blank_optional_fields_are_absent.__func__
    )
    _email_must_be_an_address = field_validator("email")(
        EmployeeBase.email_must_be_an_address.__func__
    )

    # The identity rules, identical to creation — a partial update must not be a
    # side door around what the create path rejects. Reused from `EmployeeCreate`
    # rather than re-declared, so the two can never drift apart.
    _full_name_is_a_name = field_validator("full_name", mode="before")(
        EmployeeCreate.full_name_is_a_name.__func__
    )
    _optional_phones_are_dialable = field_validator(
        "phone_secondary", "wallet_number", mode="before"
    )(EmployeeCreate.optional_phones_are_dialable.__func__)
    _national_id_is_real = field_validator("national_id", mode="before")(
        EmployeeCreate.national_id_is_real.__func__
    )
    _bank_account_is_shaped = field_validator("bank_account", mode="before")(
        EmployeeCreate.bank_account_is_shaped.__func__
    )
    _amounts_are_sane = field_validator(
        "base_salary",
        "fixed_bonus",
        "discipline_bonus",
        "default_deductions",
        mode="before",
    )(EmployeeCreate.amounts_are_sane.__func__)
    _percents_are_sane = field_validator(
        "commission_rate",
        "assistant_commission_rate",
        "bonus_min_attendance_percent",
        mode="before",
    )(EmployeeCreate.percents_are_sane.__func__)
    _username_is_shaped = field_validator("username", mode="before")(
        EmployeeCreate.username_is_shaped.__func__
    )

    @field_validator("phone_primary", mode="before")
    @classmethod
    def phone_primary_is_dialable_when_given(cls, value):
        """A missing phone means "keep the current one" — but an empty or
        invalid one, given explicitly, is still an error."""
        if value is None:
            return None
        error = employee_rules.phone_error(value)
        if error:
            raise ValueError(error)
        return employee_rules.normalize_phone(value)

    @model_validator(mode="after")
    def contract_cannot_end_before_the_hire_date(self):
        # Only possible when the caller sent both in one request. A partial
        # update that moves just one of them is not enough to judge, so the
        # stored value stands and the comparison only runs when both are given.
        if self.contract_end_date and self.hire_date:
            hired = (
                self.hire_date.date()
                if isinstance(self.hire_date, datetime)
                else self.hire_date
            )
            if self.contract_end_date < hired:
                raise ValueError("تاريخ انتهاء العقد لا يمكن أن يسبق تاريخ التعيين")
        return self

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


class EmployeePOSItem(BaseModel):
    """Slim staff row for POS terminals.

    Payroll-free on purpose: ``GET /employees`` (with base_salary /
    commission_rate / phone) stays manage-employees-only, while cashiers and
    barbers need only identity + service links to run the till.
    """

    id: int
    full_name: str
    display_name: Optional[str] = None
    job_title: str
    profile_image_url: Optional[str] = None
    service_ids: List[int] = []

    model_config = ConfigDict(
        from_attributes=True
    )



