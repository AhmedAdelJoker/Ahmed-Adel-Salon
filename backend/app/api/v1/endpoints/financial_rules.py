from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.db.session import get_db
from app.models.user import User
from app.services.activity_service import log_activity
from app.services.runtime_settings_service import (
    get_runtime_settings,
    update_runtime_settings,
)

router = APIRouter(prefix="/financial-rules", tags=["Financial Rules"])

DEFAULT_FINANCIAL_RULES = {
    "taxRate": 0,
    "cashierDiscountLimit": 50,
    "requireDiscountReason": True,
    "requireManagerApprovalAboveLimit": True,
    "requireOpenShiftForInvoices": True,
    "lockInvoicesAfterShiftClose": True,
    "allowNegativeInventory": False,
    "enableProductCostTracking": True,
    "enableExpenseApproval": True,
    "maxCashDiscrepancyWithoutNote": 0,
    "defaultPaymentMethod": "cash",
    "enabledPaymentMethods": {
        "cash": True,
        "card": True,
        "wallet": True,
        "instapay": True,
    },
}

ALLOWED_PAYMENT_METHODS = {"cash", "card", "wallet", "instapay", "mada"}


class EnabledPaymentMethodsPayload(BaseModel):
    cash: bool = True
    card: bool = True
    wallet: bool = True
    instapay: bool = True
    mada: bool = False

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class FinancialRulesPayload(BaseModel):
    tax_rate: float = 0
    cashier_discount_limit: float = 50
    require_discount_reason: bool = True
    require_manager_approval_above_limit: bool = True
    require_open_shift_for_invoices: bool = True
    lock_invoices_after_shift_close: bool = True
    allow_negative_inventory: bool = False
    enable_product_cost_tracking: bool = True
    enable_expense_approval: bool = True
    max_cash_discrepancy_without_note: float = 0
    default_payment_method: str = "cash"
    enabled_payment_methods: EnabledPaymentMethodsPayload = EnabledPaymentMethodsPayload()

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


def _sanitize_financial_rules(data: dict) -> dict:
    merged = {**DEFAULT_FINANCIAL_RULES, **(data or {})}
    enabled_payment_methods = merged.get("enabledPaymentMethods", {})
    if not isinstance(enabled_payment_methods, dict):
        enabled_payment_methods = {}
    merged["enabledPaymentMethods"] = {
        **DEFAULT_FINANCIAL_RULES["enabledPaymentMethods"],
        **{
            key: bool(value)
            for key, value in enabled_payment_methods.items()
            if key in ALLOWED_PAYMENT_METHODS
        },
    }
    merged["taxRate"] = max(0, float(merged.get("taxRate", 15) or 0))
    merged["cashierDiscountLimit"] = max(
        0, float(merged.get("cashierDiscountLimit", 50) or 0)
    )
    merged["maxCashDiscrepancyWithoutNote"] = max(
        0, float(merged.get("maxCashDiscrepancyWithoutNote", 0) or 0)
    )
    default_payment_method = str(
        merged.get("defaultPaymentMethod", "cash") or "cash"
    ).strip().lower()
    if default_payment_method not in ALLOWED_PAYMENT_METHODS:
        default_payment_method = "cash"
    merged["defaultPaymentMethod"] = default_payment_method
    return merged


@router.get("", response_model=FinancialRulesPayload)
def read_financial_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    del db, current_user
    return _sanitize_financial_rules(
        get_runtime_settings("financial_rules", DEFAULT_FINANCIAL_RULES)
    )


@router.put("", response_model=FinancialRulesPayload)
def update_financial_rules(
    payload: FinancialRulesPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    previous = _sanitize_financial_rules(
        get_runtime_settings("financial_rules", DEFAULT_FINANCIAL_RULES)
    )
    updated = _sanitize_financial_rules(
        update_runtime_settings(
            "financial_rules",
            payload.model_dump(by_alias=True),
            DEFAULT_FINANCIAL_RULES,
        )
    )
    log_activity(
        db,
        user_id=current_user.id,
        action="update_financial_rules",
        entity_type="financial_rules",
        description="تم تحديث القواعد المالية",
        old_values=previous,
        new_values=updated,
    )
    return updated



