from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class CashTransactionBase(BaseModel):
    direction: str
    type: str
    amount: Decimal
    payment_method: str = "cash"
    reference_no: Optional[str] = None
    notes: Optional[str] = None
    transaction_date: Optional[datetime] = None


class CashTransactionCreate(CashTransactionBase):
    pass


class CashTransactionRead(CashTransactionBase):
    id: int
    transaction_no: Optional[str] = None
    is_voided: bool
    created_at: datetime
    created_by_user_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class CashboxSummary(BaseModel):
    total_in: Decimal
    total_out: Decimal
    cash_balance: Decimal
    today_sales: Decimal
    today_expenses: Decimal
    today_net: Decimal
