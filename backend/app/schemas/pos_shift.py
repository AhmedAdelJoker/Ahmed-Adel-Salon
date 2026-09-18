from fastapi.middleware.cors import CORSMiddleware
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.schemas.expense import ExpenseRead


class PosShiftOpen(BaseModel):
    opening_cash: Decimal = Field(default=Decimal("0.00"), ge=0)

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )


class PosShiftClose(BaseModel):
    counted_cash: Decimal = Field(..., ge=0)
    manager_review_note: Optional[str] = None
    denominations_json: Optional[str] = None
    discrepancy_note: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )


class PosShiftRead(BaseModel):
    id: int
    cashier_user_id: int
    opened_by_user_id: Optional[int] = None
    opening_cash: Decimal
    expected_cash: Decimal
    counted_cash: Optional[Decimal] = None
    cash_difference: Optional[Decimal] = None
    status: str
    
    # Financial Report Fields
    total_sales: Optional[Decimal] = None
    total_expenses: Optional[Decimal] = None
    total_commissions: Optional[Decimal] = None
    net_cash: Optional[Decimal] = None
    
    # Snapshot Fields
    service_sales_snapshot: Optional[Decimal] = None
    product_sales_snapshot: Optional[Decimal] = None
    tax_snapshot: Optional[Decimal] = None
    expenses_snapshot: Optional[Decimal] = None
    commissions_snapshot: Optional[Decimal] = None
    tips_snapshot: Optional[Decimal] = None
    
    discrepancy_note: Optional[str] = None
    denominations_json: Optional[str] = None
    
    opened_at: datetime
    closed_at: Optional[datetime] = None
    closed_by_user_id: Optional[int] = None
    manager_reviewed_by_user_id: Optional[int] = None
    manager_review_note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )


class DailySummaryUserRead(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DailySummaryShiftRead(BaseModel):
    """Shift row for the daily summary timeline (typed subset + live sales)."""

    id: int
    status: str
    opened_at: datetime
    closed_at: Optional[datetime] = None
    total_sales: Decimal = Decimal("0")
    invoice_count: int = 0
    user: Optional[DailySummaryUserRead] = None

    model_config = ConfigDict(from_attributes=True)


class DailySummaryTotals(BaseModel):
    total_sales: Decimal
    invoice_count: int
    total_expenses: Decimal
    shift_count: int


class DailySummaryResponse(BaseModel):
    date: date
    shifts: list[DailySummaryShiftRead]
    expenses: list[ExpenseRead]
    summary: DailySummaryTotals



