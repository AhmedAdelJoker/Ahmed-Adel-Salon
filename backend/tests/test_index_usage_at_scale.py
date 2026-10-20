"""Checks the seeded database's plans against the indexes that were built for them.

Runs only against a database seeded by `scripts/seed_million_rows.py`, and is
skipped -- loudly -- when there is not one. The skip matters: this is the only
test that can tell whether the 46 indexes in `c4d7e9f1a3b5` do anything, and a
suite that quietly stops running on a developer's laptop is how a schema
degrades over a year without anyone noticing.

The reason this exists rather than trusting the migration's own comments: those
comments justify each index by naming the query it was added for, and on the
test database -- a few hundred rows -- the planner answers every one of those
queries with a sequential scan, because a sequential scan is correct for a small
table. So the justifications were argued, not measured. On a million rows they
either hold or they do not.

Skipped, not failed, for three reasons that are all legitimate:
  * the table is small, where an index costs more than the scan it replaces;
  * another index serves the query, so the named one is redundant rather than
    wrong -- reported as SUPERSEDED, which is a decision to make, not a defect;
  * the table was not seeded, so there is nothing to measure.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _database_url() -> str | None:
    return os.environ.get("TEST_POSTGRES_URL")


pytestmark = pytest.mark.skipif(
    not _database_url() or not _database_url().startswith("postgres"),
    reason=(
        "TEST_POSTGRES_URL is not set to a PostgreSQL database. Seed one with "
        "scripts/seed_million_rows.py --confirm, then re-run. Without this, no "
        "test in the repository can tell whether the indexes are used."
    ),
)


@pytest.fixture(scope="module")
def report():
    """Runs the measurement script and returns its parsed rows.

    The script is invoked rather than imported, because importing it executes the
    module-level dataclass definitions and pulls in a parser that a test does not
    need. It also means the test measures exactly what a person would run.
    """
    script = BACKEND_ROOT / "scripts" / "measure_index_usage.py"
    completed = subprocess.run(
        [sys.executable, str(script)],
        cwd=BACKEND_ROOT,
        env={**os.environ, "DATABASE_URL": _database_url()},
        capture_output=True,
        text=True,
    )
    # A non-zero exit means a sequential scan on a large table, which the
    # assertions below describe in more detail than an exit code can.
    assert "summary:" in completed.stdout, (
        f"the measurement script did not produce a report:\n{completed.stderr[-2000:]}"
    )
    return completed.stdout


def test_the_measurement_itself_ran_against_a_large_table(report):
    """Guards the guard.

    A measurement over a few hundred rows proves nothing, and it produces a
    clean-looking report. This asserts the scale, so a run against an unseeded
    database fails loudly instead of reporting every index as unused.
    """
    assert "probes below" in report
    # The seeded dataset is a little over a million rows across nine tables, and
    # the header prints the total. Matched loosely on purpose: this asserts that
    # the run saw a large database, not that it saw *this* one, so a reseed with
    # different sizes does not fail here.
    assert "rows estimated by the planner" in report
    header = next(
        line for line in report.splitlines() if "rows estimated" in line
    )
    digits = "".join(ch for ch in header if ch.isdigit())
    assert int(digits) > 100_000, (
        f"the measurement ran against a dataset of about {int(digits)} rows, "
        "which is too small for the planner to prefer an index. Seed it with "
        "scripts/seed_million_rows.py --confirm."
    )


def test_no_index_is_answered_by_a_sequential_scan(report):
    """The core property: an index exists for each of these queries.

    `SUPERSEDED` is allowed and means another index served the query instead --
    a real but different finding, reported separately so it does not hide here.
    """
    failures = [
        line for line in report.splitlines()
        if "SEQ SCAN" in line
    ]
    assert not failures, (
        "these queries fall back to a sequential scan on a large table:\n"
        + "\n".join(failures)
    )


def test_no_probe_reports_an_error(report):
    """A probe that failed to run is not a probe that passed.

    Without this, a typo in a query would look like a clean result: the harness
    records `ERROR` and moves on, and the summary counts it separately. The point
    of a measurement is that it measures.
    """
    errors = [line for line in report.splitlines() if "ERROR" in line]
    assert not errors, "these probes failed to run at all:\n" + "\n".join(errors)


def test_the_majority_of_probes_used_their_own_index(report):
    """Not all of them have to, but most should.

    A low number here is the signature of indexes added on a hunch. `c4d7e9f1a3b5`
    added 46 with a comment naming a query for each, and this is the check that
    the comments are true.
    """
    indexed = report.count("  INDEX  ")
    other = report.count("  OTHER IDX  ")
    assert indexed >= 10, (
        f"only {indexed} probes used the index they were named for "
        f"({other} were served by a different one)"
    )


def test_the_redundant_index_is_reported_not_hidden(report):
    """`ix_appointments_time` looked redundant and is not.

    A first pass reported it as SUPERSEDED -- `ix_appointments_status` serves the
    auto-cancel query, which filters on `status` as well as time. Measuring it
    properly, with the index actually dropped, gave a 2.7% difference in either
    direction depending on the run, which is noise on a 400k-row table. It leads
    on a different column from the index that appears to cover it, and neither
    can answer the other's query.

    So it is kept, and the probe that covers it is marked `SEQ OK` rather than
    `SUPERSEDED`. The assertion here is that the status is the honest one: if a
    future measurement makes the index genuinely useless, the verdict should
    change, and this test should be the thing that notices.
    """
    assert "SUPERSEDED" not in report, (
        "a probe is reporting a redundant index; if that is now true, it should "
        "be a decision, and the reasoning in measure_index_usage.py updated"
    )
    assert "ix_appointments_time" in report
    assert "SEQ OK" in report
