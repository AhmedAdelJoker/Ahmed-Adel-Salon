"""Identity rules for employee records.

The Python side of `frontend/src/features/hr/utils/` — same rules, same Arabic
messages, so an owner who sees a sentence while typing meets the identical
sentence if they ever find it in an API error.

The API is the actual gate. Until this module existed, `national_id="!!!"` and
`phone_primary="abc-def!"` were stored happily, and two of the rows already on
this machine carry it: one 13-digit national id, one with an embedded day 84.
Numbers are normalized to English digits on the way in (an Arabic keyboard
produces ٠١٠… , which is the same number) and validated for the shape their
issuer actually promises.

The Egyptian national id's check digit is deliberately NOT verified: the
algorithm is not published and implementations disagree, so rejecting a real id
is a worse failure than accepting a fabricated one. Length, century, a real
calendar date and a real governorate catch every mistake a person can make.
"""

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

_DIGIT_TRANSLATION = {
    **{0x0660 + i: str(i) for i in range(10)},  # Arabic-Indic ٠-٩
    **{0x06F0 + i: str(i) for i in range(10)},  # Extended Arabic-Indic ۰-۹
}


def to_english_digits(value: Any) -> str:
    """Arabic-Indic and Persian numerals become ASCII; everything else stays."""
    if value is None:
        return ""
    return str(value).translate(_DIGIT_TRANSLATION)


def digits_only(value: Any) -> str:
    """The digits inside a value: numerals read as English, separators dropped."""
    return re.sub(r"\D", "", to_english_digits(value))


# ── Phone ────────────────────────────────────────────────────────────────────

PHONE_MIN_DIGITS = 8
PHONE_MAX_DIGITS = 15

# ── Service providers ────────────────────────────────────────────────────────

# Who serves customers directly. Only these job titles can ever appear on the
# public booking site (with the owner's `show_in_booking` switch on): an
# accountant, a cashier, a manager, an admin or an unlinked assistant cannot,
# even if the switch was flipped by a mistyped role change. Keep in sync with
# `SERVICE_PROVIDER_JOB_TITLES` in the frontend
# (frontend/src/features/hr/utils/helpers.ts).
SERVICE_PROVIDER_JOB_TITLES = ("barber", "colorist", "esthetician")


def is_service_provider_job_title(value: Any) -> bool:
    """True for the job titles that provide salon services to customers."""
    return str(value or "").strip().lower() in SERVICE_PROVIDER_JOB_TITLES


def phone_error(value: Any) -> Optional[str]:
    """A primary number has to be dialable. Returns the reason, or None."""
    digits = digits_only(value)

    if not digits:
        return "رقم الجوال مطلوب"

    # A key held down, or the same digit walked across the keypad. Six in a
    # row, not five: an Egyptian number like 01000007777 legitimately contains
    # a five-run, and rejecting a real number is worse than accepting one
    # odd-looking fake.
    if re.search(r"(\d)\1{5,}", digits):
        return "رقم الجوال غير صحيح (أرقام متكررة)"

    if not (PHONE_MIN_DIGITS <= len(digits) <= PHONE_MAX_DIGITS):
        return "رقم الجوال غير صحيح (من 8 إلى 15 رقمًا)"

    # Egyptian mobiles are 11 digits starting 01; when it looks Egyptian but is
    # not, say the Egyptian rule rather than a generic length error.
    if digits.startswith("01") and len(digits) != 11:
        return "رقم الجوال غير صحيح (رقم محمول مصري = 11 رقمًا يبدأ بـ 01)"

    if re.fullmatch(r"0\d{0,2}", digits):
        return "رقم الجوال غير صحيح"

    return None


def normalize_phone(value: Any) -> str:
    return digits_only(value)


# ── Egyptian national id ─────────────────────────────────────────────────────

NATIONAL_ID_LENGTH = 14

GOVERNORATE_NAMES = {
    "01": "القاهرة",
    "02": "الإسكندرية",
    "03": "بورسعيد",
    "04": "السويس",
    "05": "دمياط",
    "06": "الدقهلية",
    "07": "الشرقية",
    "08": "القليوبية",
    "09": "كفر الشيخ",
    "10": "الغربية",
    "11": "المنوفية",
    "12": "البحيرة",
    "13": "الإسماعيلية",
    "14": "الجيزة",
    "15": "بني سويف",
    "16": "الفيوم",
    "17": "المنيا",
    "18": "أسيوط",
    "19": "سوهاج",
    "20": "قنا",
    "21": "أسوان",
    "22": "الأقصر",
    "23": "البحر الأحمر",
    "24": "الوادي الجديد",
    "25": "مطروح",
    "26": "شمال سيناء",
    "27": "جنوب سيناء",
    "88": "خارج الجمهورية",
}


def national_id_error(value: Any) -> Optional[str]:
    """Structural validation. Empty is "not recorded", which is legal."""
    digits = digits_only(value)
    if not digits:
        return None

    if len(digits) != NATIONAL_ID_LENGTH:
        return f"رقم الهوية يجب أن يكون {NATIONAL_ID_LENGTH} رقمًا بالضبط"

    century = digits[0]
    if century not in ("2", "3"):
        return "رقم الهوية غير صحيح: أول رقم يجب أن يكون 2 أو 3"

    info = _parse_national_id_digits(digits)
    if info is None:
        return "رقم الهوية يحتوي على تاريخ ميلاد غير صحيح"

    governorate_code = digits[7:9]
    if governorate_code not in GOVERNORATE_NAMES and not (
        1 <= int(governorate_code) <= 35
    ):
        return "رقم الهوية يحتوي على كود محافظة غير معروف"

    return None


def _parse_national_id_digits(digits: str) -> Optional[dict]:
    """C YY MM DD of a 14-digit id as a real calendar date, or None."""
    year = (1900 if digits[0] == "2" else 2000) + int(digits[1:3])
    month = int(digits[3:5])
    day = int(digits[5:7])
    try:
        birth_date = date(year, month, day)
    except ValueError:
        return None
    return {"birth_date": birth_date}


def parse_national_id(value: Any) -> Optional[dict]:
    """Decode a valid id into birth date and governorate, or None."""
    digits = digits_only(value)
    if not digits or national_id_error(digits) is not None:
        return None
    info = _parse_national_id_digits(digits)
    if info is None:
        return None
    code = digits[7:9]
    return {
        **info,
        "governorate_code": code,
        "governorate_name": GOVERNORATE_NAMES.get(code, f"محافظة {code}"),
    }


# ── Names and usernames ──────────────────────────────────────────────────────

NAME_MIN_LENGTH = 2
NAME_MAX_LENGTH = 100

_NAME_DIGIT_RE = re.compile(r"[0-9\u0660-\u0669\u06f0-\u06f9]")
# Letters (any script) separated by spaces and the punctuation real names carry.
_NAME_ALLOWED_RE = re.compile(r"[^\W\d_]+(?:[\s'.-][^\W\d_]+)*")


def person_name_error(value: Any) -> Optional[str]:
    text = normalize_person_name(value)

    if not text:
        return "الاسم مطلوب"
    if len(text) < NAME_MIN_LENGTH:
        return "الاسم قصير جدًا"
    if len(text) > NAME_MAX_LENGTH:
        return f"الاسم طويل جدًا ({NAME_MAX_LENGTH} حرف كحد أقصى)"
    if _NAME_DIGIT_RE.search(text):
        return "الاسم لا يمكن أن يحتوي على أرقام"
    if not _NAME_ALLOWED_RE.fullmatch(text):
        return "الاسم يحتوي على رموز غير مسموحة"

    return None


def normalize_person_name(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


_USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,30}$")


def username_error(value: Any) -> Optional[str]:
    """Usernames authenticate, so they stay ASCII — an Arabic one can never log in."""
    text = str(value or "").strip()

    if not text:
        return "اسم المستخدم مطلوب"
    if not _USERNAME_RE.fullmatch(text):
        return "اسم المستخدم: من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا أو . _ -"

    return None


# ── Money and percentages ────────────────────────────────────────────────────

MONEY_MAX = Decimal("1000000")


def _as_decimal(value: Any) -> Optional[Decimal]:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def money_error(value: Any, label: str) -> Optional[str]:
    """A money amount: a number, non-negative, within the sanity ceiling."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None

    amount = _as_decimal(value)
    if amount is None:
        return f"{label} يجب أن يكون رقمًا"
    if amount < 0:
        return f"{label} لا يمكن أن يكون بالسالب"
    if amount > MONEY_MAX:
        return f"{label} يتجاوز الحد الأقصى (1,000,000)"

    return None


def percent_error(value: Any, label: str = "النسبة") -> Optional[str]:
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None

    amount = _as_decimal(value)
    if amount is None:
        return f"{label} يجب أن تكون رقمًا"
    if amount < 0 or amount > 100:
        return f"{label} من 0 إلى 100%"

    return None


# ── Bank accounts ────────────────────────────────────────────────────────────


def bank_account_error(value: Any) -> Optional[str]:
    """EG IBANs are `EG` + 27 digits; anything else is a local account number."""
    text = str(value or "").strip()
    if not text:
        return None

    compact = re.sub(r"\s+", "", to_english_digits(text)).upper()
    if compact.startswith("EG"):
        if re.fullmatch(r"EG\d{27}", compact):
            return None
        return "رقم IBAN المصري يبدأ بـ EG ويتبعه 27 رقمًا"
    if re.fullmatch(r"[A-Za-z0-9/.-]{4,34}", compact):
        return None
    return "رقم الحساب البنكي غير صالح"
