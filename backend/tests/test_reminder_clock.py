"""Reminder windows must be measured on the salon's clock.

`send_due_reminders` decides whether a customer gets their 24-hour and 2-hour
WhatsApp reminder by testing the appointment's wall-clock time against a window
built from "now":

    now = <a clock>
    target_24h_from = now + 23h45m
    ...
    appointment_dt = datetime.combine(appointment.appointment_date,
                                      appointment.appointment_time)
    if target_24h_from <= appointment_dt <= target_24h_to:

`appointment_dt` is a reading of a shop wall clock: a date and a time of day a
human set. Comparing it against the *server's* now compares two different
timezones, and the error does not cancel -- the whole window shifts by the
offset. On a UTC server with a Cairo salon every reminder is three hours late,
and an appointment sitting on the edge of a window is skipped outright, so the
customer is told nothing.

This test pins which clock is used, because the failure is invisible: the code
still runs, still sends messages, and no assertion anywhere was watching.
"""

from datetime import date, time, timedelta
from datetime import timezone as _tz

import pytest

from app.core.clock import salon_now, utc_now


def _service_source() -> str:
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "app" / "services" / "reminder_service.py"
    return path.read_text(encoding="utf-8")


def _appointment_offset_hours() -> float:
    """How far the salon clock is from UTC, right now."""
    salon = salon_now()
    utc = utc_now()
    return (salon.replace(tzinfo=utc.tzinfo) - utc).total_seconds() / 3600


class TestReminderClock:
    def test_the_two_clocks_differ(self):
        """The premise. If the salon ran on UTC this test file proves nothing,
        and the bug would return unnoticed."""
        assert abs(_appointment_offset_hours()) > 0.5

    def test_it_does_not_use_the_server_clock(self):
        source = _service_source()
        body = source.split("def send_due_reminders", 1)[1]
        first_now = next(
            line for line in body.splitlines() if re_search_assigns_now(line)
        )
        assert "salon_now()" in first_now, (
            f"send_due_reminders must measure on the salon clock, got: {first_now.strip()}"
        )

    def test_it_does_not_use_utc_now(self):
        """UTC would be just as wrong, in the other direction: the appointment
        wall clock is not UTC either."""
        body = _service_source().split("def send_due_reminders", 1)[1]
        first_now = next(
            line for line in body.splitlines() if re_search_assigns_now(line)
        )
        assert "utc_now" not in first_now, first_now


def re_search_assigns_now(line: str) -> bool:
    import re

    return bool(re.search(r"^\s*now\s*=", line))


class TestWindowAlignment:
    """The window has to line up with an appointment built from date + time."""

    def test_an_appointment_in_the_window_is_inside_it(self):
        now = salon_now()
        target = now + timedelta(hours=24)
        appointment_dt = datetime_combine(target.date(), target.timetz().replace(tzinfo=None))
        assert now + timedelta(hours=23, minutes=45) <= appointment_dt <= now + timedelta(
            hours=24, minutes=15
        )

    def test_the_same_instant_on_the_wrong_clock_falls_outside_the_window(self):
        """This is the bug, as arithmetic rather than as a source pattern.

        The appointment reading is *always* on the salon clock: it is composed
        from `appointment_date` and `appointment_time`, two business columns a
        human set. Only `now` moves. So the window slides by the offset while
        the appointment stays put, and an appointment sitting on the window's
        centre is now three hours outside it and gets no reminder.

        (Shifting both sides would cancel and prove nothing -- which is exactly
        what the first draft of this test did.)
        """
        offset = _appointment_offset_hours()
        if abs(offset) < 0.5:
            pytest.skip("clocks agree; nothing to demonstrate")

        salon = salon_now()
        server = utc_now().replace(tzinfo=None)

        # An appointment 24h away, read the way the code reads it: on the
        # salon's wall clock, because that is what the business columns say.
        intended = salon + timedelta(hours=24)

        # The window, however, was built from the server's clock.
        window_from = server + timedelta(hours=23, minutes=45)
        window_to = server + timedelta(hours=24, minutes=15)

        assert not (window_from <= intended <= window_to), (
            "the appointment should have fallen outside the UTC-built window; "
            "if it does not, the offsets cancelled and this test is not "
            "demonstrating what it claims"
        )

        # And the same window built on the salon clock does contain it.
        good_from = salon + timedelta(hours=23, minutes=45)
        good_to = salon + timedelta(hours=24, minutes=15)
        assert good_from <= intended <= good_to


def datetime_combine(d, t):
    from datetime import datetime

    return datetime.combine(d, t)