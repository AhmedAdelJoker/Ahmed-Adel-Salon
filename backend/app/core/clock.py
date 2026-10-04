"""One clock for the whole backend.

Two rules the salon depends on:

* Working hours, POS shifts and attendance are *wall-clock* concepts. They must
  be evaluated in the salon's timezone, never the server's.
* Persisted timestamps are UTC. Comparisons between a naive "now" and a stored
  value silently drop rows when the server runs in a different zone, which is how
  a shift report ends up under-reporting money.

Use :func:`salon_now` for anything a human reasons about ("is the salon open
right now?") and :func:`utc_now` for anything written to the database.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone, tzinfo

try:  # pragma: no cover - exercised implicitly by every test importing the app
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore[assignment]

    class ZoneInfoNotFoundError(Exception):  # type: ignore[no-redef]
        pass


DEFAULT_TIMEZONE = "Africa/Cairo"

_cache: dict[str, tzinfo] = {}


def resolve_timezone(name: str | None) -> tzinfo:
    """Return a tzinfo for ``name``, degrading to a fixed offset when unknown."""
    key = (name or DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE
    cached = _cache.get(key)
    if cached is not None:
        return cached

    zone: tzinfo
    if ZoneInfo is not None:
        try:
            zone = ZoneInfo(key)
            _cache[key] = zone
            return zone
        except (ZoneInfoNotFoundError, ValueError, KeyError):
            pass
    zone = timezone(timedelta(hours=3), name=key)
    _cache[key] = zone
    return zone


def salon_timezone() -> tzinfo:
    from app.core.config import settings

    return resolve_timezone(getattr(settings, "SALON_TIMEZONE", None))


def utc_now() -> datetime:
    """Timezone-aware UTC, the only thing that should hit the database."""
    return datetime.now(timezone.utc)


def salon_now() -> datetime:
    """Naive wall-clock time in the salon's timezone.

    Naive on purpose: SQLite has no timezone type, and the existing rows were all
    written as naive local time. Mixing these with :func:`utc_now` values is what
    the old code did and it silently lost rows.
    """
    return datetime.now(salon_timezone()).replace(tzinfo=None)


def utc_now_naive() -> datetime:
    """Naive UTC, for rows that predate the timezone-aware columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_salon(moment: datetime) -> datetime:
    """Normalise any stored timestamp to naive salon wall-clock time."""
    if moment.tzinfo is not None:
        moment = moment.astimezone(salon_timezone()).replace(tzinfo=None)
    return moment


def coerce_naive(moment: datetime | None) -> datetime | None:
    """Make a value comparable against naive wall-clock stamps."""
    if moment is None:
        return None
    return to_salon(moment) if moment.tzinfo is not None else moment


def is_same_instant(a: datetime, b: datetime) -> bool:
    left = a if a.tzinfo is not None else a.replace(tzinfo=timezone.utc)
    right = b if b.tzinfo is not None else b.replace(tzinfo=timezone.utc)
    return left == right
