"""Proves the static guard would have caught the original defect.

A checker that has never failed is not known to work. This reconstructs the
`record_invoice_payment` broadcast exactly as it was — sync endpoint,
`asyncio.ensure_future`, wrapped in a broad `except` — and asserts the guard
flags it. Run it manually; it is excluded from the suite because it
intentionally contains a bug.
"""

import ast
import re
import sys

ASYNC_ONLY = re.compile(
    r"\b(asyncio\.(ensure_future|create_task|gather|wait|wait_for)|loop\.run_until_complete)\b"
)
BROADCAST_TARGETS = re.compile(r"\bmanager\.(broadcast|send_personal_message)\b")
SWALLOW = re.compile(r"except\s+Exception")

# Verbatim shape of the code that shipped, reconstructed from
# api/v1/endpoints/invoices.py before the fix.
OLD_CODE = '''
@router.post("/invoices/{invoice_id}/payments")
def record_invoice_payment(invoice_id: int, db: Session = Depends(get_db)):
    """Payment lands; notify the POS board."""
    if payload.appointment_id:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(manager.broadcast({
                    "event": "appointment_status_changed",
                    "status": "completed",
                }))
            else:
                loop.run_until_complete(manager.broadcast({
                    "event": "appointment_status_changed",
                    "status": "completed",
                }))
        except Exception as e:
            logger.warning("WebSocket broadcast error: %s", e)
    return {"ok": True}
'''

# The shape that replaced it.
NEW_CODE = '''
@router.post("/invoices/{invoice_id}/payments")
def record_invoice_payment(invoice_id: int, db: Session = Depends(get_db)):
    """Payment lands; notify the POS board."""
    if payload.appointment_id:
        manager.publish({
            "event": "appointment_status_changed",
            "status": "completed",
        })
    return {"ok": True}
'''


def scan(source: str) -> list[str]:
    findings = []
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
            continue
        body = ast.get_source_segment(source, node) or ""
        if not BROADCAST_TARGETS.search(body):
            continue
        if isinstance(node, ast.AsyncFunctionDef):
            continue
        offenders = sorted({m.group(1) for m in ASYNC_ONLY.finditer(body)})
        if offenders:
            findings.append(f"{node.name}(): {', '.join(offenders)}")
        elif SWALLOW.search(body):
            findings.append(f"{node.name}(): broad except")
    return findings


old = scan(OLD_CODE)
new = scan(NEW_CODE)

print(f"old code findings: {old or 'NONE — the guard would have missed the bug'}")
print(f"new code findings: {new or 'none — clean'}")

if not old:
    print("\nFAIL: the guard does not detect the original defect", file=sys.stderr)
    raise SystemExit(1)
if new:
    print("\nFAIL: the guard flags the fixed code", file=sys.stderr)
    raise SystemExit(1)

print("\nguard verified: it flags the old shape and passes the new one")
