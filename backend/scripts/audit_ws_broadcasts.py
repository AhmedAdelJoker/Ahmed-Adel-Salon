"""Reports which endpoint each WebSocket broadcast call lives in, and whether
that endpoint is sync or async.

A broadcast reached from a *sync* endpoint cannot use `asyncio.ensure_future`:
FastAPI runs sync endpoints in a threadpool, where no event loop is running, so
the call raises RuntimeError. If that call sits inside a `try/except`, the event
is silently lost and nothing in the UI ever updates.
"""

import re
from pathlib import Path

ENDPOINTS = Path("app/api/v1/endpoints")

DEF_RE = re.compile(r"^(\s*)(async\s+)?def\s+(\w+)\s*\(", re.MULTILINE)
BROADCAST_RE = re.compile(r"manager\.(broadcast|send_personal_message)\s*\(")

for path in sorted(ENDPOINTS.glob("*.py")):
    text = path.read_text(encoding="utf-8")
    for match in BROADCAST_RE.finditer(text):
        line_no = text[: match.start()].count("\n") + 1
        # Nearest preceding `def` is the enclosing handler.
        owner = None
        for d in DEF_RE.finditer(text):
            if d.start() > match.start():
                break
            owner = d
        if owner is None:
            continue
        is_async = bool(owner.group(2))
        owner_line = text[: owner.start()].count("\n") + 1
        print(
            f"{path.name}:{line_no}  broadcast in "
            f"{owner.group(3)}()  [{'async' if is_async else 'SYNC'}]  (def at line {owner_line})"
        )
