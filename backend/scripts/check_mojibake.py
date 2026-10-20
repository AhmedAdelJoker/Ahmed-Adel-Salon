"""Scans Python sources and data for mojibake and replacement characters.

The audit already flagged one corrupted default
(`ReportSchedule.name` -> "\ufffd\ufffd\ufffd\ufffd ..."), and the E2E run
turned up visibly garbled Arabic in the owner dashboard header. If the seeded
demo rows are corrupted the same way, the damage is on screen rather than in
the schema, so a static check that only looks at code misses it entirely.

Two distinct faults are detected:

  * U+FFFD REPLACEMENT CHARACTER — text that was decoded as the wrong encoding
    and re-encoded, losing the original bytes. Unrecoverable without a backup.
  * Latin/Arabic splice — a word boundary that runs the wrong way, which is
    usually a partially-corrected corruption.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET_DIRS = ["app", "tests"]

SPLICE = re.compile(
    r"([\u0600-\u06FF])([A-Za-z]{2,})|([A-Za-z]{2,})([\u0600-\u06FF])"
)

SKIP_DIRS = {"__pycache__", ".venv", "venv", "alembic", "dist"}


def iter_files():
    for name in TARGET_DIRS:
        base = ROOT / name
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix != ".py":
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            yield path


def main() -> int:
    findings = []

    for path in iter_files():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            findings.append((path, 0, f"not valid UTF-8: {exc}"))
            continue

        rel = path.relative_to(ROOT)
        for number, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            # Skip docstrings and prose comments: a splice in a comment is
            # prose about the fix, not shipped copy.
            is_comment = stripped.startswith("#")
            if "\ufffd" in line:
                findings.append((rel, number, "U+FFFD replacement char: " + stripped[:100]))
            elif not is_comment:
                for match in SPLICE.finditer(line):
                    findings.append(
                        (rel, number, f"script splice {match.group(0)!r}: " + stripped[:100])
                    )

    if not findings:
        print("no mojibake found in backend sources")
        return 0

    print(f"{len(findings)} mojibake site(s):\n")
    for rel, number, detail in findings:
        print(f"  {rel}:{number}  {detail}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
