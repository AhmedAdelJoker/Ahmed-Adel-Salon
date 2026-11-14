"""Timezone boundaries between the salon's day and UTC-stored timestamps.

Stored timestamps are UTC. SQLite's `CURRENT_TIMESTAMP` always is, and the Python
writers use `utc_now_naive`. A "today" filter built from a *local* midnight is
therefore comparing two different clocks, and selects a 24-hour window that is
offset by the UTC offset from the one the shop means.

With Cairo at UTC+3 the error is three hours, which is not a rounding difference:
the first hours of the shop's morning land in yesterday's total and the last
hours of today are counted as tomorrow's.

These tests pin the bounds rather than the arithmetic, because the arithmetic is
in `clock.py` and the thing worth protecting is the *decision*: shop dates against
timestamp columns must be converted, and business date columns must not be.
"""
from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.core.clock import (
    salon_day_bounds_utc,
    salon_month_start_utc,
    salon_now,
    salon_timezone,
    salon_year_start_utc,
    utc_now,
)


def _as_salon(moment: datetime) -> str:
    """Render a naive-UTC instant the way a shop clock would read it."""
    aware = moment.replace(tzinfo=timezone.utc)
    return aware.astimezone(salon_timezone()).strftime("%Y-%m-%d %H:%M")


class TestSalonDayBounds:
    def test_bounds_are_exactly_the_shops_day(self):
        day = date(2026, 10, 11)
        start, end = salon_day_bounds_utc(day)

        assert _as_salon(start) == "2026-10-11 00:00"
        assert _as_salon(end).startswith("2026-10-11 23:59")

    def test_the_window_is_24_hours_of_utc(self):
        start, end = salon_day_bounds_utc(date(2026, 10, 11))
        assert timedelta(hours=23, minutes=59, seconds=59) < (end - start) < timedelta(hours=24)

    def test_it_is_not_utc_midnight(self):
        """The regression this exists for.

        `datetime.combine(day, time.min)` and `salon_day_bounds_utc(day)` agree
        on the *date* and disagree on the *instant*. They look interchangeable in
        a diff, which is why this is asserted explicitly rather than left to the
        arithmetic.
        """
        day = date(2026, 10, 11)
        naive_local_midnight = datetime.combine(day, time.min)

        start, _ = salon_day_bounds_utc(day)

        assert naive_local_midnight == datetime(2026, 10, 11, 0, 0)
        assert start != naive_local_midnight
        assert (naive_local_midnight - start) == timedelta(hours=3)

    def test_a_sale_at_1am_cairo_belongs_to_that_shop_day(self):
        """The case that makes the difference visible in money.

        01:00 Cairo on the 11th is 22:00 UTC on the 10th, so it shares a UTC date
        with neither "today" by coincidence nor a naive local-midnight filter.
        It belongs to the 11th's takings.
        """
        _, end = salon_day_bounds_utc(date(2026, 10, 11))
        assert end > datetime(2026, 10, 10, 22, 0)

    def test_contains_the_current_moment_whatever_the_hour(self):
        now = utc_now().replace(tzinfo=None)
        start, end = salon_day_bounds_utc(salon_now().date())
        assert start <= now <= end

    def test_defaults_to_the_current_salon_day(self):
        assert salon_day_bounds_utc() == salon_day_bounds_utc(salon_now().date())

    @pytest.mark.parametrize("day", [date(2026, 1, 1), date(2026, 3, 31), date(2026, 12, 31)])
    def test_month_and_year_edges_do_not_crash(self, day):
        assert salon_day_bounds_utc(day)
        assert salon_month_start_utc(day)
        assert salon_year_start_utc(day)


class TestMonthAndYearBounds:
    def test_month_starts_at_the_shops_first_of_the_month(self):
        start = salon_month_start_utc(date(2026, 10, 11))
        assert _as_salon(start) == "2026-10-01 00:00"

    def test_year_starts_at_the_shops_first_of_january(self):
        start = salon_year_start_utc(date(2026, 10, 11))
        assert _as_salon(start) == "2026-01-01 00:00"

    def test_month_boundary_is_not_utc_midnight(self):
        """Anchoring the month to UTC midnight slides it by three hours, which is
        enough to file an expense recorded just after opening under the wrong
        month."""
        start = salon_month_start_utc(date(2026, 10, 11))
        assert start != datetime(2026, 10, 1, 0, 0)
        assert (datetime(2026, 10, 1, 0, 0) - start) == timedelta(hours=3)


class TestConvention:
    def test_the_shop_and_utc_clocks_actually_differ(self):
        """If they ever coincide, the tests above pass for the wrong reason and
        the regression returns unnoticed. Assert the premise."""
        salon = salon_now()
        utc = utc_now()
        offset_hours = (salon.replace(tzinfo=utc.tzinfo) - utc).total_seconds() / 3600
        assert offset_hours != 0, "salon and UTC agree; the offsets are untestable"

    def test_salon_timezone_is_configured(self):
        assert salon_timezone() is not None