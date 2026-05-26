from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ShopSettingsBase(BaseModel):
    shop_name: Optional[str] = None
    legal_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_number: Optional[str] = None
    commercial_register: Optional[str] = None
    logo_url: Optional[str] = None
    invoice_footer: Optional[str] = None
    currency_code: Optional[str] = None
    currency_symbol: Optional[str] = None
    default_language: Optional[str] = None
    default_direction: Optional[str] = None
    receipt_width: Optional[str] = None
    tax_enabled: Optional[int] = None
    tax_rate: Optional[float] = None
    discount_enabled: Optional[int] = None
    allow_negative_cash: Optional[int] = None
    max_upload_size_mb: Optional[int] = None


class ShopSettingsOut(ShopSettingsBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CashTransactionCreate(BaseModel):
    direction: str
    amount: float
    payment_method: Optional[str] = "cash"
    notes: Optional[str] = None


class CashTransactionOut(BaseModel):
    id: int
    transaction_no: str
    type: str
    direction: str
    amount: float
    balance_after: Optional[float] = None
    payment_method: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    reference_no: Optional[str] = None
    notes: Optional[str] = None
    is_voided: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    entity_name: str
    entity_id: Optional[str] = None
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DashboardCoreSummary(BaseModel):
    total_in: float
    total_out: float
    cash_balance: float
    today_sales: float
    today_expenses: float
    today_net: float




