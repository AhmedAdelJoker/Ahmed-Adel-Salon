from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ExpenseBase(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    recipient_name: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field("cash", max_length=50)
    expense_date: Optional[datetime] = None
    invoice_image_url: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, max_length=30)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(ExpenseBase):
    pass


class ExpenseRead(ExpenseBase):
    id: int
    status: str
    created_by_user_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExpenseSummary(BaseModel):
    total_amount: float
    count: int
    categories: list[dict] = []


class ExpenseArchiveResponse(BaseModel):
    items: list[ExpenseRead]
    total: int
    total_amount: float
