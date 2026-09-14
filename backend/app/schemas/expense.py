from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ExpenseCreator(BaseModel):
    id: int
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    profile_image_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ExpenseBase(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    recipient_name: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field("cash", max_length=50)
    expense_date: Optional[datetime] = None
    invoice_image_url: Optional[str] = Field(None, max_length=500)
    reference_type: Optional[str] = Field(None, max_length=50)
    reference_id: Optional[int] = None
    internal_notes: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, max_length=30)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(ExpenseBase):
    pass


class ExpenseRead(ExpenseBase):
    id: int
    status: str
    created_by_user_id: Optional[int] = None
    created_by_user: Optional[ExpenseCreator] = None
    # alias for frontend convenience
    created_by: Optional[ExpenseCreator] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ExpenseSummary(BaseModel):
    total_amount: float
    count: int
    categories: list[dict] = []


class ExpenseArchiveResponse(BaseModel):
    items: list[ExpenseRead]
    total: int
    total_amount: float
