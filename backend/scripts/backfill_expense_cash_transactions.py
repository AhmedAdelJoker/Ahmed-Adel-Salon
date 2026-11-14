"""Backfill missing cash movements for legacy approved expenses.

Context
-------
Expenses approved before the expense↔cash-box integration was wired (or
created by paths that bypassed it) left no `cash_transactions` row of type
`expense_payment` behind. The ledger therefore overstates the cash position.

What this script does
---------------------
1. Finds approved expenses with amount > 0 that have no non-voided
   `reference_type='expense'` + `type='expense_payment'` cash transaction.
2. With no flags: DRY RUN — prints what would be inserted, nothing is written.
3. With --apply: inserts one `expense_payment` row per missing expense,
   dated at the expense's date, then recomputes `balance_after` for EVERY
   non-voided transaction chronologically (it is derived data; only a full
   re-walk keeps it consistent once historical rows are inserted), in a
   single transaction. An `audit_logs` entry records the backfill run.

Usage
-----
    cd backend
    .venv/Scripts/python.exe scripts/backfill_expense_cash_transactions.py
    .venv/Scripts/python.exe scripts/backfill_expense_cash_transactions.py --apply
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.main import app  # noqa: F401  imports every model so mappers resolve

from app.db.session import SessionLocal
from app.models.cash_transaction import CashTransaction
from app.models.expense import Expense
from app.crud.core_business import generate_cash_transaction_no


def find_missing(db):
    rows = (
        db.query(Expense)
        .filter(Expense.status == "approved", Expense.amount > 0)
        .all()
    )
    missing = []
    for exp in rows:
        existing = (
            db.query(CashTransaction)
            .filter(
                CashTransaction.reference_type == "expense",
                CashTransaction.reference_id == exp.id,
                CashTransaction.type == "expense_payment",
                CashTransaction.is_voided == 0,
            )
            .first()
        )
        if existing is None:
            missing.append(exp)
    return missing


def recompute_running_balance(db):
    """Rewrite balance_after for all non-voided rows, chronologically."""
    rows = (
        db.query(CashTransaction)
        .filter(CashTransaction.is_voided == 0)
        .order_by(CashTransaction.transaction_date.asc(), CashTransaction.id.asc())
        .all()
    )
    balance = 0.0
    for row in rows:
        delta = float(row.amount) if row.direction == "in" else -float(row.amount)
        balance += delta
        row.balance_after = round(balance, 2)
        db.add(row)
    return balance


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        missing = find_missing(db)
        print(f"Approved expenses missing a cash movement: {len(missing)}")
        for exp in missing:
            print(f"  id={exp.id:>4}  amount={exp.amount:>8.2f}  title={str(exp.title)!r}  date={exp.expense_date}")
        if not missing:
            print("Nothing to backfill.")
            return
        total = sum(float(e.amount) for e in missing)
        print(f"Total cash out to register: {total:.2f}")

        if not args.apply:
            print("\nDRY RUN — no changes written. Re-run with --apply to write.")
            return

        for exp in missing:
            row = CashTransaction(
                transaction_no=generate_cash_transaction_no(),
                type="expense_payment",
                direction="out",
                amount=float(exp.amount),
                payment_method=(exp.payment_method or "cash"),
                notes=f"مصروف معتمد (backfill): {exp.title or ('مصروف ' + str(exp.category))} - {exp.category}",
                reference_type="expense",
                reference_id=exp.id,
                reference_no=f"EXP-{exp.id}",
                transaction_date=exp.expense_date or datetime.now(),
                user_id=None,  # unknown — legacy row, see audit entry
            )
            db.add(row)
        db.flush()

        final_balance = recompute_running_balance(db)

        db.execute(
            text(
                "INSERT INTO audit_logs (user_id, user_name, action, entity_name, entity_id, old_values, new_values, created_at) "
                "VALUES (NULL, 'system-backfill', 'backfill_expense_cash_transactions', 'expense', NULL, NULL, :payload, CURRENT_TIMESTAMP)"
            ),
            {
                "payload": json.dumps(
                    {
                        "backfilled_ids": [e.id for e in missing],
                        "total_out": round(total, 2),
                        "final_balance_after": round(final_balance, 2),
                        "ran_at": datetime.now().isoformat(),
                    },
                    ensure_ascii=False,
                )
            },
        )
        db.commit()
        print(f"\nBackfill applied. Final running balance recomputed to {final_balance:.2f}.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
