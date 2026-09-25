from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ShopSettingsBase(BaseModel):
    shop_name: Optional[str] = Field(default=None, max_length=255)
    legal_name: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    whatsapp: Optional[str] = Field(default=None, max_length=30)
    email: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=500)
    tax_number: Optional[str] = Field(default=None, max_length=100)
    commercial_register: Optional[str] = Field(default=None, max_length=100)
    logo_url: Optional[str] = Field(default=None, max_length=500)
    invoice_footer: Optional[str] = Field(default=None, max_length=2000)
    currency_code: Optional[str] = Field(default=None, min_length=3, max_length=10)
    currency_symbol: Optional[str] = Field(default=None, max_length=10)
    default_language: Optional[Literal["ar", "en"]] = None
    default_direction: Optional[Literal["rtl", "ltr"]] = None
    receipt_width: Optional[str] = Field(default=None, max_length=20)
    tax_enabled: Optional[int] = Field(default=None, ge=0, le=1)
    tax_rate: Optional[float] = Field(default=None, ge=0, le=100)
    discount_enabled: Optional[int] = Field(default=None, ge=0, le=1)
    allow_negative_cash: Optional[int] = Field(default=None, ge=0, le=1)
    max_upload_size_mb: Optional[int] = Field(default=None, ge=1, le=100)


class ShopSettingsOut(ShopSettingsBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    id: int
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    profile_image_url: Optional[str] = None

    model_config = {"from_attributes": True}


class CashTransactionCreate(BaseModel):
    direction: str
    amount: float
    payment_method: Optional[str] = "cash"
    notes: Optional[str] = None
    reference_no: Optional[str] = None
    recipient_name: Optional[str] = None


class CashTransactionOut(BaseModel):
    id: int
    transaction_no: Optional[str] = None
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
    transaction_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    # المنشئ — عالمي متوسط: الاسم والدور
    user_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    created_by_user: Optional[UserBrief] = None
    user: Optional[UserBrief] = None
    # تفاصيل أكثر عند الإنشاء (المستفيد/المرجع)
    recipient_name: Optional[str] = None

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
    # --- خزنة الكاش vs غير الكاش (تفصيل احترافي) ---
    cash_in: float = 0
    cash_out: float = 0
    cash_balance_detail: float = 0
    non_cash_in: float = 0
    non_cash_out: float = 0
    non_cash_balance: float = 0
    cash_today_sales: float = 0
    cash_today_expenses: float = 0
    cash_today_net: float = 0
    non_cash_today_sales: float = 0
    non_cash_today_expenses: float = 0
    non_cash_today_net: float = 0
    # رصيد ورديات الكاشير المفتوحة (drawer)
    drawer_balance: float = 0
    drawer_open_shifts: int = 0
    by_payment_method: dict = {}
    # المدة (يوم/أسبوع/شهر/سنة/مخصص) — حساب شخصي + تقرير حركة
    period_label: str = "الكل"
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    period_in: float = 0
    period_out: float = 0
    period_net: float = 0
    period_cash_in: float = 0
    period_cash_out: float = 0
    period_cash_net: float = 0
    period_non_cash_in: float = 0
    period_non_cash_out: float = 0
    period_non_cash_net: float = 0




