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




