"""Single source of truth for the salon working-hours protocol.

Day keys are canonical lowercase English names (``saturday`` … ``friday``) and are
derived from :meth:`datetime.date.weekday` so they never depend on the C locale
(``strftime("%A")`` breaks the moment a process calls ``locale.setlocale``).

A window whose ``close_time`` is earlier than its ``open_time`` is treated as
crossing midnight, e.g. ``22:00 → 02:00`` is a 4 hour window that ends on the
next calendar day.
"""

from __future__ import annotations

import re
from datetime import date as date_cls
from datetime import datetime, time, timedelta
from typing import Any, Iterable, Mapping

DAY_KEYS: tuple[str, ...] = (
    "saturday",
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
)

_KEY_BY_WEEKDAY: dict[int, str] = {
    5: "saturday",
    6: "sunday",
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
}

DAYS_AR: dict[str, str] = {
    "saturday": "السبت",
    "sunday": "الأحد",
    "monday": "الاثنين",
    "tuesday": "الثلاثاء",
    "wednesday": "الأربعاء",
    "thursday": "الخميس",
    "friday": "الجمعة",
}

MIN_WINDOW_MINUTES = 30
_HHMM_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class WorkingHoursError(ValueError):
    """Raised when a working-hours payload cannot be trusted by consumers."""


def day_key(value: date_cls | datetime) -> str:
    """Return the canonical day key for a date/datetime, independent of locale."""
    return _KEY_BY_WEEKDAY[value.weekday()]


def parse_hhmm(value: Any) -> time | None:
    """Parse a strict ``HH:MM`` string, returning ``None`` when unusable."""
    if isinstance(value, time):
        return value
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not _HHMM_RE.match(raw):
        return None
    return time(int(raw[:2]), int(raw[3:5]))


def coerce_bool(value: Any) -> bool | None:
    """Coerce the accepted truthy/falsy shapes, returning ``None`` when invalid."""
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "1", "yes", "on"):
            return True
        if lowered in ("false", "0", "no", "off"):
            return False
    return None


def crosses_midnight(day_config: Mapping[str, Any]) -> bool:
    """True when the window ends on the calendar day after it opens."""
    open_t = parse_hhmm(day_config.get("open_time"))
    close_t = parse_hhmm(day_config.get("close_time"))
    if open_t is None or close_t is None:
        return False
    return close_t <= open_t


def window_minutes(day_config: Mapping[str, Any]) -> int:
    """Total minutes of the window, midnight-crossing windows included."""
    open_t = parse_hhmm(day_config.get("open_time"))
    close_t = parse_hhmm(day_config.get("close_time"))
    if open_t is None or close_t is None:
        return 0
    start = open_t.hour * 60 + open_t.minute
    end = close_t.hour * 60 + close_t.minute
    diff = end - start
    if diff < 0:
        diff += 24 * 60
    return diff


def closing_datetime(day: date_cls, day_config: Mapping[str, Any]) -> datetime | None:
    """Absolute moment the window closes, rolled to the next day when needed."""
    open_t = parse_hhmm(day_config.get("open_time"))
    close_t = parse_hhmm(day_config.get("close_time"))
    if open_t is None or close_t is None:
        return None
    closes = datetime.combine(day, close_t)
    if close_t <= open_t:
        closes += timedelta(days=1)
    return closes


def opening_datetime(day: date_cls, day_config: Mapping[str, Any]) -> datetime | None:
    """Absolute moment the window opens."""
    open_t = parse_hhmm(day_config.get("open_time"))
    if open_t is None:
        return None
    return datetime.combine(day, open_t)


def is_open_at(moment: datetime, day_config: Mapping[str, Any] | None) -> bool:
    """Whether ``moment`` falls inside the window described by ``day_config``."""
    if not day_config or not day_config.get("is_open"):
        return False
    return window_contains(moment, day_config)


def window_contains(moment: datetime, day_config: Mapping[str, Any]) -> bool:
    """Whether ``moment`` sits inside the window, assuming the day is open."""
    open_t = parse_hhmm(day_config.get("open_time"))
    close_t = parse_hhmm(day_config.get("close_time"))
    if open_t is None or close_t is None:
        return True
    now = moment.time()
    if open_t < close_t:
        return open_t <= now <= close_t
    return now >= open_t or now <= close_t


def empty_window() -> dict[str, Any]:
    return {"is_open": False, "open_time": None, "close_time": None}


def _build_fallback() -> dict[str, dict[str, Any]]:
    payload: dict[str, dict[str, Any]] = {}
    for key in DAY_KEYS:
        if key == "friday":
            payload[key] = empty_window()
        else:
            payload[key] = {"is_open": True, "open_time": "10:00", "close_time": "22:00"}
    return payload


DEFAULT_FALLBACK_HOURS: dict[str, dict[str, Any]] = _build_fallback()


def normalize_working_hours(raw: Any) -> dict[str, dict[str, Any]]:
    """Coerce any stored payload into a complete, trusted 7-day structure.

    Unusable entries degrade to a closed day instead of raising, so a legacy or
    hand-edited row can never crash availability, shifts or presence checks.
    """
    source: Mapping[str, Any] = raw if isinstance(raw, Mapping) else {}
    result: dict[str, dict[str, Any]] = {}
    for key in DAY_KEYS:
        result[key] = _normalize_day(source.get(key))
    return result


def _normalize_day(value: Any) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        return empty_window()
    is_open = coerce_bool(value.get("is_open"))
    if is_open is None:
        is_open = bool(value.get("is_open"))
    if not is_open:
        return empty_window()
    open_t = parse_hhmm(value.get("open_time"))
    close_t = parse_hhmm(value.get("close_time"))
    if open_t is None or close_t is None:
        return empty_window()
    return {
        "is_open": True,
        "open_time": open_t.strftime("%H:%M"),
        "close_time": close_t.strftime("%H:%M"),
    }


def validate_working_hours(raw: Any) -> dict[str, dict[str, Any]]:
    """Validate and normalize a working-hours payload before it is persisted.

    Raises:
        WorkingHoursError: with an Arabic, user-facing message describing the
            first offending day.
    """
    if raw is None:
        return {}
    if not isinstance(raw, Mapping):
        raise WorkingHoursError("ساعات العمل يجب أن تكون كائن JSON")

    unknown = [str(k) for k in raw.keys() if str(k) not in DAY_KEYS]
    if unknown:
        allowed = "، ".join(DAYS_AR[k] for k in DAY_KEYS)
        raise WorkingHoursError(
            f"أيام غير معروفة في ساعات العمل: {'، '.join(unknown)}. الأيام المسموحة: {allowed}"
        )

    validated: dict[str, dict[str, Any]] = {}
    for key in DAY_KEYS:
        value = raw.get(key)
        if value is None:
            continue
        if not isinstance(value, Mapping):
            raise WorkingHoursError(f"إعداد اليوم {DAYS_AR[key]} يجب أن يكون كائن JSON")

        label = DAYS_AR[key]
        is_open = coerce_bool(value.get("is_open", False))
        if is_open is None:
            raise WorkingHoursError(f"قيمة is_open غير صحيحة لليوم {label}")

        if not is_open:
            validated[key] = empty_window()
            continue

        open_raw = value.get("open_time")
        close_raw = value.get("close_time")
        if not open_raw or not close_raw:
            raise WorkingHoursError(f"حدد وقت الفتح والإغلاق ليوم {label}")

        open_t = parse_hhmm(open_raw)
        close_t = parse_hhmm(close_raw)
        if open_t is None or close_t is None:
            raise WorkingHoursError(
                f"صيغة الوقت غير صحيحة في {label} — يجب أن تكون HH:MM بين 00:00 و 23:59"
            )
        if open_t == close_t:
            raise WorkingHoursError(
                f"وقت الإغلاق لا يمكن أن يساوي وقت الفتح في {label}"
            )
        if window_minutes({"open_time": open_t, "close_time": close_t}) < MIN_WINDOW_MINUTES:
            raise WorkingHoursError(f"مدة الدوام قصيرة جداً في {label} (أقل من 30 دقيقة)")

        validated[key] = {
            "is_open": True,
            "open_time": open_t.strftime("%H:%M"),
            "close_time": close_t.strftime("%H:%M"),
        }

    return validated


def resolve_window(
    raw: Any, target: date_cls
) -> tuple[dict[str, Any], datetime, datetime] | None:
    """Resolve the open/close window that governs bookings on ``target``.

    The window is keyed by its **opening** day, so a ``22:00 → 02:00`` Saturday is
    bookable as 22:00 Saturday through 02:00 Sunday. A target date therefore only
    ever looks at its own key — carrying the previous day's window over would make
    00:30 bookable on Saturday *and* on Sunday, double-counting the tail.

    For "is the salon open right now" use :func:`current_window`, which does
    account for a window that started yesterday and is still running.
    """
    hours = normalize_working_hours(raw)
    today = hours.get(day_key(target))

    if not today or not today["is_open"]:
        return None

    opened = opening_datetime(target, today)
    closed = closing_datetime(target, today)
    if opened is None or closed is None:
        return None
    return today, opened, closed


def current_window(raw: Any, moment: datetime) -> tuple[dict[str, Any], datetime, datetime] | None:
    """The window that is running at ``moment``, or ``None`` when closed.

    Checks today's own window first, then a window opened yesterday that crosses
    midnight and has not finished yet — and only while it is genuinely still
    running, so a finished carry-over cannot mask the rest of the day.
    """
    hours = normalize_working_hours(raw)
    today = hours.get(day_key(moment.date()))

    if today and today["is_open"] and window_contains(moment, today):
        opened = opening_datetime(moment.date(), today)
        closed = closing_datetime(moment.date(), today)
        if opened is not None and closed is not None:
            return today, opened, closed

    yesterday = moment.date() - timedelta(days=1)
    previous = hours.get(day_key(yesterday))
    if previous and previous["is_open"] and crosses_midnight(previous):
        opened = opening_datetime(yesterday, previous)
        closed = closing_datetime(yesterday, previous)
        if opened is not None and closed is not None and moment < closed:
            return previous, opened, closed

    return None


def summarize(raw: Any) -> dict[str, Any]:
    """Aggregate counters used by KPIs and health checks."""
    hours = normalize_working_hours(raw)
    open_days = [k for k in DAY_KEYS if hours[k]["is_open"]]
    total = sum(window_minutes(hours[k]) for k in open_days)
    overnight = [k for k in open_days if crosses_midnight(hours[k])]
    return {
        "open_days": len(open_days),
        "closed_days": len(DAY_KEYS) - len(open_days),
        "total_minutes": total,
        "overnight_days": overnight,
    }


def public_payload(raw: Any) -> dict[str, Any]:
    """Shape sent to the public booking site: normalized, never malformed."""
    return normalize_working_hours(raw)


def iter_day_keys() -> Iterable[str]:
    return DAY_KEYS
