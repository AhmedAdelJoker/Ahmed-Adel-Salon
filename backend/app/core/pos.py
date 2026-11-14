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


PERCENT_LIMIT_TYPES = {"percent", "percentage", "pct", "%"}


def cashier_discount_limit(settings_row, subtotal: Decimal | None = None) -> Decimal:
    """The discount a cashier may apply without a manager's approval.

    The rule lives here so the endpoint and the POS read the same one. The
    type spelling is owner-editable and the column default is "percent",
    while the endpoint used to compare against "percentage" only — so a
    database created from the model default (rather than by the seed, which
    writes "percentage") treated a 10% limit as 10 EGP.
    """
    value = Decimal(str(getattr(settings_row, "cashier_discount_limit_value", 0) or 0))
    limit_type = str(
        getattr(settings_row, "cashier_discount_limit_type", "percent") or "percent"
    ).strip().lower()
    if limit_type in PERCENT_LIMIT_TYPES:
        base = max(Decimal("0.00"), Decimal(str(subtotal or 0)))
        return (base * value / Decimal("100")).quantize(Decimal("0.01"))
    return value.quantize(Decimal("0.01"))


def clamp_discount(subtotal: Decimal, discount_amount: Decimal) -> Decimal:
    safe_subtotal = max(Decimal("0.00"), Decimal(str(subtotal or 0)))
    safe_discount = max(Decimal("0.00"), Decimal(str(discount_amount or 0)))
    if safe_discount > safe_subtotal:
        return safe_subtotal
    return safe_discount



