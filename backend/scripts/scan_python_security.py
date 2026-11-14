"""Static analysis gate for the Python backend.

Runs Bandit twice on purpose, and suppresses nothing.

The first pass is the gate: MEDIUM severity and above fails the build. The second
pass is informational and prints every LOW finding without failing, so the tail
stays visible instead of rotting into a backlog nobody reads.

There is deliberately no skip list on the Bandit command line. A severity
threshold already decides what the gate enforces, so suppressing checks would
only hide findings from the report that exists to surface them -- and the
annotations below would then be documenting something that is not running. The
known false positives are listed so a reader knows which lines to ignore and,
more usefully, so that a *new* hit in one of those categories stands out instead
of blending into the background.

An earlier version of this script passed `-s B105,B106,B110`. It made the gate
green and the informational pass report zero findings, which is the worst of
both: the gate proved nothing and the report said there was nothing to see.

Expected LOW categories, and why each one is a false positive here. None is unimportant in general; each is a check that cannot distinguish the case it is aimed at from the case it fires on in this codebase:

B105 / B106 -- "possible hardcoded password". Fires on any string literal bound
    to a name containing `password`, `passwd`, `token`, `secret` or `pass`.
    Every hit here is a token *type* discriminator (`token_type="refresh"`,
    `"access"`, `"member_access"`, `"token_type": "bearer"`), plus the two digest
    constants in `app/core/security.py` that hash a random value that was
    discarded at generation time, plus the production guard in `config.py` that
    exists in order to *reject* the test secret. The heuristic is name-based, so
    it cannot tell a token type from a token, and no configuration separates
    them. A real hardcoded credential would be caught by the secret scanner in
    CI, which reads the value rather than the variable name.

B110 -- `try/except/pass`. Thirty-six sites, all deliberate: the guarded
    operation is genuinely best-effort, such as probing for a column before
    adding it, closing a socket, or testing whether a lock is held. Bandit
    cannot see the intent, and the intent is the entire reason the construct is
    used. The places that must not swallow an exception log or re-raise instead,
    and those exist.

The two MEDIUM findings this repository actually had, both B608, were fixed
rather than suppressed: `sqlite_master.name` binds as a parameter because it is
a value and not a grammar element, and the migration script's row count resolves
the table through `Base.metadata` so SQLAlchemy quotes it from its own
definition. `app/db/identifiers.py` covers the remaining DDL paths, where an
identifier genuinely cannot be parameterised.

Usage:
    python scripts/scan_python_security.py
    python scripts/scan_python_security.py --report-out bandit-report.json
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent

TARGETS = ["app", "scripts"]

SKIP_REASONS = {
    "B105": 'hardcoded "password"-named string; matches token_type="bearer" and the '
    "digest constants. No credential in this codebase -- the secret scanner reads values.",
    "B106": 'hardcoded password string; every hit is token_type="refresh"/"access"/'
    '"member_access". A name-based heuristic cannot separate a token type from a token.',
    "B110": "try/except/pass, 36 deliberate best-effort guards. Intent is invisible to the "
    "checker; the sites that must not swallow log or raise instead.",
    "B404": "import subprocess -- this file, which has to shell out to Bandit. Documented "
    "so that a subprocess call anywhere else shows up as NEW instead of blending in.",
    "B603": "subprocess call -- this file, invoking Bandit as an argument list with no "
    "shell=True, so no argument is ever interpreted by a shell.",
}

# Categories expected to appear in the LOW report. A finding outside this set is
# new, and that is the point of printing the report at all.
EXPECTED_LOW = {"B105", "B106", "B110", "B404", "B603"}

# Directories with no shipped code, or with code whose security properties are
# covered by a different gate.
EXCLUDES = [
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    ".git",
    "alembic/versions",
]


def run_bandit(severity: str, output: Path | None) -> tuple[int, dict]:
    """Runs Bandit with no suppression. `severity` is the gate threshold.

    The report is always written to a file, never read from stdout. Bandit writes
    its JSON to stdout only when no `-o` is given, and an earlier version of this
    function captured that stdout, discarded it, then looked for a report file it
    had never asked for -- so the informational pass reported zero findings while
    Bandit had actually found 46.
    """
    scratch = output if output is not None else BACKEND_ROOT / "bandit-report.json"
    cmd = [
        sys.executable,
        "-m",
        "bandit",
        "-r",
        *TARGETS,
        "-q",
        "--severity-level",
        severity,
        "-f",
        "json",
        "-o",
        str(scratch),
    ]
    completed = subprocess.run(cmd, cwd=BACKEND_ROOT, capture_output=True, text=True)
    report = {}
    if scratch.exists():
        with scratch.open(encoding="utf-8") as fh:
            report = json.load(fh)
        if output is None:
            scratch.unlink()
    if completed.returncode not in (0, 1) and not report:
        # Neither a clean pass nor findings: bandit itself failed, most often a
        # missing dependency. Surfacing its stderr beats reporting "clean".
        sys.stderr.write(completed.stderr or completed.stdout)
    return completed.returncode, report


def describe(findings: list[dict]) -> str:
    counts = Counter((f["issue_severity"], f["test_id"]) for f in findings)
    lines = []
    for (severity, test_id), total in counts.most_common():
        reason = SKIP_REASONS.get(test_id, "")
        marker = "" if test_id in EXPECTED_LOW else "   <-- NEW, review this"
        suffix = f"  -- {reason}" if reason else ""
        lines.append(f"  {severity:7} {test_id:6} x{total}{marker}{suffix}")
    return "\n".join(lines) if lines else "  (none)"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--report-out",
        type=Path,
        default=None,
        help="write the full JSON report here",
    )
    args = parser.parse_args()

    # Gate. MEDIUM and above fails the build.
    gate_code, gate_report = run_bandit("medium", None)

    if not gate_report:
        # No report at all means Bandit never ran: it is not installed, or it
        # could not start. `python -m bandit` exits 1 when the module is
        # missing, which is indistinguishable from "found issues", so that
        # collision reached the line below and printed `FAILED -- 0
        # finding(s)` -- a security gate reporting a failure it did not
        # measure. Distinct exit code, because this is a broken tool, not a
        # finding.
        print("could not run Bandit; the gate proved nothing")
        return 2

    blocking = [f for f in gate_report.get("results", []) if f["issue_severity"] in ("HIGH", "MEDIUM")]

    print("Bandit gate (HIGH + MEDIUM): ", end="", flush=True)
    if gate_code == 0 and not blocking:
        print("clean")
    else:
        print(f"FAILED -- {len(blocking)} finding(s)")
        for finding in blocking:
            location = f"{finding['filename']}:{finding['line_number']}"
            print(f"  [{finding['issue_severity']}] {finding['test_id']} {location}")
            print(f"      {finding['issue_text']}")
            code = (finding.get("code") or "").strip().replace("\n", " | ")
            print(f"      {code[:200]}")
        return 1

    # Informational pass. Reported so the LOW tail stays visible and does not rot
    # into a backlog nobody reads.
    _full_code, full_report = run_bandit("low", args.report_out)
    low = [f for f in full_report.get("results", []) if f["issue_severity"] == "LOW"]
    print(f"\nBandit LOW findings (reported, not enforced): {len(low)}")
    print(describe(low))
    if args.report_out is not None:
        print(f"\nFull JSON report: {args.report_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
