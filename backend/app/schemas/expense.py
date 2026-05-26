from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ExpenseBase(BaseModel):
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    recipient_name: Optional[str] = Field(None, max_length=255)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(ExpenseBase):
    pass


class ExpenseRead(ExpenseBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
