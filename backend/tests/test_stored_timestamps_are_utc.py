"""Every stored timestamp must be written in UTC.

The schema stores UTC. SQLite's ``CURRENT_TIMESTAMP`` always is, and the Python
writers are expected to use ``utc_now_naive`` or ``utc_now``. A writer that puts
``datetime.now()`` (the *server's* zone) or ``salon_now()`` (the shop's zone) into
a column produces a value that disagrees with every row around it by the UTC
offset, and nothing raises: the write succeeds, and the damage only shows up
later as a date filter that lands on the wrong day.

Three real instances of this existed and all were silent:

* ``appointments.started_at`` -- written with ``salon_now()`` while its neighbours
  were UTC. Correct only for a client sitting in Cairo.
* ``payroll_records.payment_date`` -- ``datetime.now()``, compared by date in
  payroll reports.
* ``employees.archived_at`` -- ``datetime.now()``, the archive audit trail.

This scans the source rather than the database, because a wrong value already in
a column looks exactly like a right one until something subtracts it from now.

What it deliberately does **not** forbid: assigning a clock to a *local variable*
for a business-time comparison, such as ``now = salon_now()`` used to ask whether
the shop is open. That is the correct use of the salon clock. Only writes into a
model attribute are a leak.
"""

import io
import re
from pathlib import Path

import pytest

APP_ROOT = Path(__file__).resolve().parent.parent / "app"

#: A clock expression assigned straight into an attribute: `row.when = salon_now()`.
LEAK = re.compile(
    r"^\s*[A-Za-z_][\w\.]*\.\w+\s*=\s*"
    r"(datetime\.now\(\)|datetime\.utcnow\(\)|salon_now\(\))\s*$",
    re.M,
)

#: Written in UTC, so allowed into a column.
SAFE = re.compile(
    r"^\s*[A-Za-z_][\w\.]*\.\w+\s*=\s*(utc_now\(\)|utc_now_naive\(\))\s*$", re.M
)


def _python_sources():
    for path in sorted(APP_ROOT.rglob("*.py")):
        yield path, io.open(path, encoding="utf-8").read()


def _scan():
    findings = []
    for path, text in _python_sources():
        for match in LEAK.finditer(text):
            line_no = text[: match.start()].count("\n") + 1
            findings.append(
                (path.relative_to(APP_ROOT.parent).as_posix(), line_no, match.group(1))
            )
    return findings


def test_no_clock_is_written_into_a_column_in_a_non_utc_zone():
    findings = _scan()
    assert not findings, (
        "A clock is written into a stored timestamp column in a zone other than "
        "UTC. Use utc_now_naive():\n"
        + "\n".join(f"  {p}:{n}  {expr}" for p, n, expr in findings)
    )


def test_the_salon_clock_is_still_available_for_business_comparisons():
    """Guards against over-correcting this into a blanket ban.

    `salon_now()` is the right clock for "is the shop open right now". A fix that
    replaced every `salon_now` with a UTC clock would quietly move opening hours
    three hours and this test exists so that mistake is visible.
    """
    used_for_comparison = [
        (p, n)
        for p, text in _python_sources()
        for n, line in enumerate(text.splitlines(), 1)
        if re.search(r"now\s*=\s*salon_now\(\)", line)
    ]
    assert used_for_comparison, (
        "salon_now() is no longer used anywhere; the salon clock should still "
        "exist for wall-clock questions"
    )


@pytest.mark.parametrize(
    "expression",
    ["utc_now()", "utc_now_naive()"],
)
def test_utc_helpers_are_writable_into_columns(expression):
    """The safe pattern must actually be present, or the test above is
    satisfied by nobody ever assigning a clock at all."""
    assert any(
        SAFE.search(line)
        for _path, text in _python_sources()
        for line in text.splitlines()
    ), f"no column is written with {expression} -- the convention is unused"


class TestStartedAtConvention:
    def test_started_at_has_exactly_one_writer(self):
        """It was written from two places with two different clocks."""
        writers = []
        for path, text in _python_sources():
            for match in re.finditer(r"appointment\.started_at\s*=\s*(\w+)\(\)", text):
                writers.append((path.name, match.group(1)))
        assert len(writers) == 1, f"started_at has multiple writers: {writers}"

    def test_started_at_is_written_in_utc(self):
        _path, text = _single_started_at_writer()
        assert "appointment.started_at = utc_now_naive()" in text, (
            "started_at must be stored in UTC, like every neighbouring column"
        )


def _single_started_at_writer():
    for path, text in _python_sources():
        if "appointment.started_at = " in text:
            return path, text
    raise AssertionError("no writer for appointment.started_at found")