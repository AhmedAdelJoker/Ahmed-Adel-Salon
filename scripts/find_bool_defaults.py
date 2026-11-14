"""Find boolean columns in migrations whose server_default is an integer literal.

PostgreSQL rejects `boolean DEFAULT 0`; it wants `DEFAULT false`. SQLite accepts
both. So a migration can be perfectly valid for years on SQLite and fail on the
first column it touches on Postgres -- which is what happened at
7afda716e6ea, the sixth revision.

The detection is a regex rather than an import because the migrations are not
importable modules; they are files that get exec'd by Alembic.
"""

import re
import sys
from pathlib import Path

VERSIONS = Path(__file__).resolve().parent.parent / "backend" / "alembic" / "versions"
if not VERSIONS.exists():
    VERSIONS = Path("alembic/versions")

# Matches a sa.Column(...) whose type is Boolean (with or without parens) and
# whose server_default is a bare numeric literal or sa.text of one.
COLUMN = re.compile(
    r'sa\.Column\(\s*["\'][^"\']+["\']\s*,\s*sa\.Boolean(?:\(\))?'
    r'[^)]*?server_default\s*=\s*(?P<default>sa\.text\(\s*["\'][01]["\']\s*\)'
    r'|["\'][01]["\']|[01])',
    re.DOTALL,
)

findings = []
for path in sorted(VERSIONS.glob("*.py")):
    text = path.read_text(encoding="utf-8")
    for match in COLUMN.finditer(text):
        default = match.group("default").strip()
        value = re.sub(r"^sa\.text\(", "", default).strip("()'\" ")
        if value in {"0", "1"}:
            line = text[: match.start()].count("\n") + 1
            findings.append((path.name, line, match.group(0).split("server_default")[0].strip(), value))

if not findings:
    print("No boolean columns with an integer server_default.")
    sys.exit(0)

print(f"{len(findings)} boolean column(s) with an integer server_default:\n")
for name, line, column, value in findings:
    print(f"  {name}:{line}")
    print(f"      {column} server_default={value}")
print()
print("PostgreSQL raises DatatypeMismatch on these: 'column X is of type")
print("boolean but default expression is of type integer'. SQLite accepts them,")
print("so the failure only appears on the dialect nobody tested with.")
print()
print("Fix: sa.false() / sa.true(), which SQLAlchemy renders per dialect.")
sys.exit(1)
