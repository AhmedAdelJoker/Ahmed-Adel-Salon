"""Backfill missing cash movements for legacy non-draft invoices.

Context
-------
The invoice→cash-box integration only started writing `invoice_payment`
movements for invoices created through the POS flow. Every earlier invoice
(34 non-draft rows, May–Oct 2026) left no trace in `cash_transactions`, so
the cash position was understated by the total of recorded sales.

Scope rules
-----------
* Only `payment_method = 'cash'` invoices are backfilled: the cash actually
  entered the drawer as one cash sale of `total_amount`.
* `payment_method = 'split'` (and any card/wallet/bank figures) are NOT
  auto-filled — the share that was cash is unknowable from the invoice row.
  They are printed as unreconciled and must be settled by hand.
* Invoices that already have a non-voided `invoice_payment` movement are
  skipped (the integration-era rows stay untouched).
* `is_draft = 1` rows are ignored entirely.

Usage
-----
    cd backend
    .venv/Scripts/python.exe scripts/backfill_invoice_cash_transactions.py
    .venv/Scripts/python.exe scripts/backfill_invoice_cash_transactions.py --apply
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.main import app  # noqa: F401  imports every model so mappers resolve
from app.db.session import SessionLocal
from app.models.cash_transaction import CashTransaction
from app.models.invoice import Invoice
from app.models.invoice_payment import InvoicePayment
from app.crud.core_business import generate_cash_transaction_no


def find_missing(db):
    rows = (
        db.query(Invoice)
        .filter(Invoice.is_draft == 0)
        .order_by(Invoice.created_at.asc(), Invoice.id.asc())
        .all()
    )
    backfillable, skipped_existing, unreconciled = [], [], []
    for inv in rows:
        existing = (
            db.query(CashTransaction)
            .filter(
                CashTransaction.reference_type == "invoice",
                CashTransaction.reference_id == inv.id,
                CashTransaction.type == "invoice_payment",
                CashTransaction.is_voided == 0,
            )
            .first()
        )
        if existing is not None:
            skipped_existing.append(inv)
            continue
        if (inv.payment_method or "cash").lower() == "cash":
            backfillable.append(inv)
        else:
            unreconciled.append(inv)
    return backfillable, skipped_existing, unreconciled


def recompute_running_balance(db):
    rows = (
        db.query(CashTransaction)
        .filter(CashTransaction.is_voided == 0)
        .order_by(CashTransaction.transaction_date.asc(), CashTransaction.id.asc())
        .all()
    )
    balance = Decimal("0")
    for row in rows:
        delta = Decimal(str(row.amount)) if row.direction == "in" else -Decimal(str(row.amount))
        balance += delta
        row.balance_after = balance
        db.add(row)
    return balance


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        backfillable, skipped_existing, unreconciled = find_missing(db)
        print(f"Cash invoices without a cash movement: {len(backfillable)}")
        for inv in backfillable:
            print(f"  id={inv.id:>4}  {inv.invoice_no:<22} amount={inv.total_amount:>8}  date={inv.created_at}")
        print(f"Already linked (integration era, untouched): {len(skipped_existing)}")
        if unreconciled:
            print(f"NOT auto-filled (split/card — needs manual settlement): {len(unreconciled)}")
            for inv in unreconciled:
                print(f"  id={inv.id:>4}  {inv.invoice_no:<22} method={inv.payment_method} amount={inv.total_amount}  date={inv.created_at}")

        total = sum(Decimal(str(inv.total_amount)) for inv in backfillable)
        print(f"\nTotal cash in to register: {total}")

        if not backfillable:
            print("Nothing to backfill.")
            return
        if not args.apply:
            print("\nDRY RUN — no changes written. Re-run with --apply to write.")
            return

        for inv in backfillable:
            amount = Decimal(str(inv.total_amount))
            db.add(
                InvoicePayment(
                    invoice_id=inv.id,
                    payment_method="cash",
                    amount=amount,
                    reference_no=inv.invoice_no,
                    received_by_user_id=None,  # legacy sale — receiver unknown
                    received_at=inv.created_at or datetime.now(),
                )
            )
            db.add(
                CashTransaction(
                    transaction_no=generate_cash_transaction_no(),
                    type="invoice_payment",
                    direction="in",
                    amount=amount,
                    payment_method="cash",
                    notes=f"دفعة فاتورة (backfill): {inv.invoice_no}",
                    reference_type="invoice",
                    reference_id=inv.id,
                    reference_no=inv.invoice_no,
                    transaction_date=inv.created_at or datetime.now(),
                    user_id=None,
                )
            )
        db.flush()

        final_balance = recompute_running_balance(db)

        db.execute(
            text(
                "INSERT INTO audit_logs (user_id, user_name, action, entity_name, entity_id, old_values, new_values, created_at) "
                "VALUES (NULL, 'system-backfill', 'backfill_invoice_cash_transactions', 'invoice', NULL, NULL, :payload, CURRENT_TIMESTAMP)"
            ),
            {
                "payload": json.dumps(
                    {
                        "backfilled_invoice_ids": [inv.id for inv in backfillable],
                        "backfilled_count": len(backfillable),
                        "total_in": str(total),
                        "unreconciled_split_invoices": [inv.id for inv in unreconciled],
                        "final_balance_after": str(final_balance),
                        "ran_at": datetime.now().isoformat(),
                    },
                    ensure_ascii=False,
                )
            },
        )
        db.commit()
        print(f"\nBackfill applied. Final running balance recomputed to {final_balance}.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
