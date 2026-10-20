"""Static guard: no endpoint may broadcast from a thread without a loop.

`record_invoice_payment` is declared `def`, so FastAPI runs it in a threadpool
where no event loop is running. Its broadcast called `asyncio.ensure_future`,
which raises there, and the surrounding `except Exception` swallowed it — so
paying an invoice never refreshed the POS board, on any deployment, with only a
log line as evidence.

A regression test that reproduces the runtime behaviour is the right tool, but
this guard is cheaper and catches the mistake at authoring time, before anyone
runs the suite. Together they are belt and braces: one proves the mechanism
works, the other stops the anti-pattern being reintroduced.
"""

import ast
import re
from pathlib import Path

ENDPOINTS = Path("app/api/v1/endpoints")

# Calls that need a running loop. `publish` is deliberately absent: it is
# synchronous and is the correct call from a sync endpoint.
ASYNC_ONLY = re.compile(r"\b(asyncio\.(ensure_future|create_task|gather|wait|wait_for)|loop\.run_until_complete)\b")

# Managers that own event-loop-bound objects.
BROADCAST_TARGETS = re.compile(r"\bmanager\.(broadcast|send_personal_message)\b")

# A broad `except Exception` around a broadcast is what turns a crash into a
# silent drop, so its presence is part of the finding rather than a mitigation.
SWALLOW = re.compile(r"except\s+Exception")

findings: list[str] = []
scanned = 0

for path in sorted(ENDPOINTS.glob("*.py")):
    source = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:  # pragma: no cover
        findings.append(f"{path.name}: could not parse ({exc})")
        continue

    for node in ast.walk(tree):
        if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
            continue

        body = ast.get_source_segment(source, node) or ""
        if not BROADCAST_TARGETS.search(body):
            continue

        scanned += 1
        is_async = isinstance(node, ast.AsyncFunctionDef)
        if is_async:
            continue

        offenders = sorted({m.group(1) for m in ASYNC_ONLY.finditer(body)})
        if offenders:
            findings.append(
                f"{path.name}:{node.lineno}  {node.name}() is sync and uses "
                f"{', '.join(offenders)} — no event loop runs in a threadpool"
            )
        elif SWALLOW.search(body):
            findings.append(
                f"{path.name}:{node.lineno}  {node.name}() broadcasts inside a broad "
                f"`except Exception`, so a delivery failure is invisible"
            )

print(f"broadcasting endpoints scanned: {scanned}")
if findings:
    print(f"\n{len(findings)} problem(s):\n")
    for finding in findings:
        print(f"  {finding}")
    raise SystemExit(1)

print("no sync-endpoint broadcast hazards found")
