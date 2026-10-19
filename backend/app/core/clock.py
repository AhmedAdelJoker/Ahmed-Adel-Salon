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

from datetime import date as _date
from datetime import datetime, time, timedelta, timezone, tzinfo

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


def _salon_boundary_utc(day: _date) -> datetime:
    """Naive UTC instant of local midnight starting `day`."""
    tz = salon_timezone()
    return (
        datetime.combine(day, time.min, tzinfo=tz)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )


def salon_month_start_utc(day: _date | None = None) -> datetime:
    """Naive UTC instant at which the shop's month containing `day` begins.

    The month is the shop's month, so it starts at the shop's local midnight --
    expressed in UTC, because that is what the timestamp columns hold. Anchoring
    to UTC midnight instead would put the boundary three hours off, which is
    enough to move an expense recorded just after opening onto the wrong month.
    """
    if day is None:
        day = salon_now().date()
    return _salon_boundary_utc(day.replace(day=1))


def salon_year_start_utc(day: _date | None = None) -> datetime:
    """Naive UTC instant at which the shop's year containing `day` begins."""
    if day is None:
        day = salon_now().date()
    return _salon_boundary_utc(day.replace(month=1, day=1))


def salon_day_bounds_utc(day: _date | None = None) -> tuple[datetime, datetime]:
    """The UTC window that covers one *salon calendar day*.

    ## Why this exists

    Stored timestamps are UTC -- SQLite's ``CURRENT_TIMESTAMP`` always is, and
    ``utc_now_naive`` is what the Python writers use. So a "today" filter built
    as ``datetime.combine(today, time.min)`` is comparing a **local** midnight
    against a **UTC** column, and selects the wrong window by exactly the UTC
    offset.

    With Cairo at UTC+3 that error is three hours, and it is not a rounding
    difference: the window ``[00:00 local, 23:59:59 local]`` covers UTC
    ``[21:00 the previous day, 21:00 today)``. The first three hours of the
    salon's morning are attributed to yesterday, and the last three hours of
    today are counted as tomorrow. On a till-reporting screen "today's sales" is
    simply the wrong day.

    ## Why not just use the UTC day

    ``utc_now_naive().date()`` would be *consistent* but wrong for the same
    reason from the other side: it is the UTC day, not the shop's. A sale at
    01:00 Cairo belongs to the previous shop's day even though it shares a UTC
    date with the new one. This helper takes the salon's day as the human means
    it and expresses it in the clock the data is stored in.

    ## What it is not

    The bounds are naive UTC, because the columns they are compared against hold
    naive UTC. Mixing an aware value back in is the "silently lost rows" case
    documented on :func:`utc_now_naive`.
    """
    if day is None:
        day = salon_now().date()
    tz = salon_timezone()
    start_local = datetime.combine(day, time.min, tzinfo=tz)
    end_local = datetime.combine(day, time.max, tzinfo=tz)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


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
