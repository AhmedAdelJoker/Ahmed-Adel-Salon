from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from decimal import Decimal


EGYPT_PAYMENT_METHODS = {
    "cash": "Cash",
    "vodafone_cash": "Vodafone Cash",
    "instapay": "InstaPay",
    "bank_card": "Bank Card",
}


def normalize_payment_method(value: str | None) -> str:
    payment_method = str(value or "cash").strip().lower()
    aliases = {
        "card": "bank_card",
        "wallet": "vodafone_cash",
        "transfer": "instapay",
    }
    payment_method = aliases.get(payment_method, payment_method)
    if payment_method not in EGYPT_PAYMENT_METHODS:
        raise ValueError("invalid_payment_method")
    return payment_method


def is_payment_method_enabled(settings_row, payment_method: str) -> bool:
    payment_method = normalize_payment_method(payment_method)
    if payment_method == "cash":
        return bool(getattr(settings_row, "allow_cash", True))
    if payment_method == "vodafone_cash":
        return bool(getattr(settings_row, "allow_vodafone_cash", True))
    if payment_method == "instapay":
        return bool(getattr(settings_row, "allow_instapay", True))
    if payment_method == "bank_card":
        return bool(getattr(settings_row, "allow_bank_card", True))
    return False


def cashier_discount_limit(settings_row) -> Decimal:
    value = getattr(settings_row, "cashier_discount_limit_value", 0) or 0
    return Decimal(str(value))


def clamp_discount(subtotal: Decimal, discount_amount: Decimal) -> Decimal:
    safe_subtotal = max(Decimal("0.00"), Decimal(str(subtotal or 0)))
    safe_discount = max(Decimal("0.00"), Decimal(str(discount_amount or 0)))
    if safe_discount > safe_subtotal:
        return safe_subtotal
    return safe_discount



