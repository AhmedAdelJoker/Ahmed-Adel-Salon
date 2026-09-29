"""Rewrites integer server_defaults on boolean columns to sa.true()/sa.false().

SQLAlchemy renders these per dialect -- `false` on PostgreSQL, `0` on SQLite --
so one expression is correct on both, where the literal form is only ever
correct on one.

Deliberately narrow: it matches a boolean column whose server_default is a bare
`0` or `1`, optionally wrapped in `sa.text(...)`. A default of `0` on an Integer
column, or a string default of `"0"`, is left alone -- those are correct as
written, and a broader rewrite would corrupt them.
"""

import re
import sys
from pathlib import Path

VERSIONS = Path("alembic/versions")

# Only inside a sa.Column whose type is Boolean. Anchored on the column name
# quote so it cannot match a comment or a different column type.
#
# Three default spellings appear across the history and all three are wrong on
# PostgreSQL:
#     server_default=1          bare integer
#     server_default=sa.text("1")   integer wrapped for SQLAlchemy
#     server_default="1"        a quoted string, which renders as DEFAULT '1'
PATTERN = re.compile(
    r'(?P<head>sa\.Column\(\s*["\'][^"\']+["\']\s*,\s*sa\.Boolean(?:\(\))?[^)]*?server_default\s*=\s*)'
    r'(?P<default>sa\.text\(\s*["\'](?P<text_value>[01])["\']\s*\)'
    r'|(?P<quoted>["\'](?P<quoted_value>[01])["\'])'
    r'|(?P<raw_value>[01]))',
    re.DOTALL,
)


def rewrite(text: str) -> tuple[str, int]:
    changed = 0

    def replace(match: re.Match) -> str:
        nonlocal changed
        value = (
            match.group("text_value")
            or match.group("quoted_value")
            or match.group("raw_value")
        )
        changed += 1
        replacement = "sa.true()" if value == "1" else "sa.false()"
        return match.group("head") + replacement

    return PATTERN.sub(replace, text), changed


def main() -> int:
    total = 0
    for path in sorted(VERSIONS.glob("*.py")):
        original = path.read_text(encoding="utf-8")
        updated, changed = rewrite(original)
        if not changed:
            continue
        path.write_text(updated, encoding="utf-8")
        print(f"  {path.name}: {changed} rewritten")
        total += changed
    print(f"Total: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
