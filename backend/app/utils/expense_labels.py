"""Canonical Arabic labels for expense categories.

Expense categories are free-text, so legacy / English values (e.g. "salaries",
"rent", "supplies") can coexist with the canonical Arabic labels used by the
UI ("رواتب", "إيجار", ...). This module maps known variants to their Arabic
canonical label WITHOUT changing stored data — summaries expose ``label_ar``
alongside the raw ``name`` so clients can display (and merge) consistently.
"""

EXPENSE_CATEGORY_AR: dict[str, str] = {
    "salaries": "رواتب",
    "salary": "رواتب",
    "payroll": "رواتب",
    "wages": "رواتب",
    "rent": "إيجار",
    "rents": "إيجار",
    "purchases": "مشتريات",
    "supplies": "مشتريات",
    "products": "مشتريات",
    "stock": "مشتريات",
    "inventory": "مشتريات",
    "tools": "أدوات",
    "equipment": "أدوات",
    "electricity": "كهرباء",
    "electric": "كهرباء",
    "power": "كهرباء",
    "water": "مياه",
    "internet": "إنترنت",
    "wifi": "إنترنت",
    "maintenance": "صيانة",
    "repair": "صيانة",
    "repairs": "صيانة",
    "marketing": "تسويق",
    "ads": "تسويق",
    "advertising": "تسويق",
    "hospitality": "ضيافة",
    "advance": "سلف",
    "advances": "سلف",
    "loan": "سلف",
    "loans": "سلف",
    "utilities": "مرافق",
    "other": "أخرى",
    "others": "أخرى",
    "general": "أخرى",
    "misc": "أخرى",
    "miscellaneous": "أخرى",
}


def _contains_arabic(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06FF" for ch in text)


def expense_label_ar(name: object) -> str:
    """Return the canonical Arabic display label for a stored category.

    Arabic values pass through untouched; known English/legacy variants map
    to their canonical label; unknown values fall back to the raw string so
    no data is ever hidden. Empty values become "أخرى".
    """
    if name is None:
        return "أخرى"
    text = str(name).strip()
    if not text:
        return "أخرى"
    if _contains_arabic(text):
        return text
    return EXPENSE_CATEGORY_AR.get(text.lower(), text)
