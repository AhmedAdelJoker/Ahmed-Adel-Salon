"""add_phase2_remaining_critical_indexes

Phase 2 — Backend/DB Optimization (remaining high-priority indexes).

Complements 9f2a1c4e7b01 (customers/invoices/appointments) and
a8e1c4f29b3d (service_sessions/pos_shifts/activity/expenses category).

This migration adds the STILL missing critical indexes from audit §5.3:

- expenses.status                (filter by status, not covered before)
- payroll_records: created_at, status, employee_id, user_id,
  and composite (employee_id, period_year, period_month)  — (employee+period)
- pos_shifts.opened_at           (single-column, complements composite user_id+opened_at)
- payroll / expenses / pos_shifts / audit / activity group: ensures
  every table has at least a created_at (or opened_at) index for
  date-range scans at 1M-row scale.

Idempotent: skips indexes that already exist.
Postgres-compatible: uses op.create_index (not PRAGMA).
Not duplicated with runtime_schema.py: runtime already has
ix_invoices_created_at, ix_expenses_created_at, etc. — this file
does NOT recreate those; it only adds indexes that runtime + prior
Alembic do NOT provide (see _INDEXES doc below).

Reversible: downgrade drops indexes in reverse order.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7e2f1a9c4d0"
down_revision: Union[str, None] = "c9d4f2a87b31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Each tuple: (index_name, table_name, columns)
# - Do NOT duplicate runtime_schema._ensure_index names (see backend/app/db/runtime_schema.py):
#   ix_invoices_created_at, ix_invoices_barber_created, ix_expenses_expense_date,
#   ix_expenses_created_at, ix_appointments_date_status_barber, ix_customers_is_deleted,
#   ix_invoice_items_invoice_id, ix_cash_transactions_date
#   => those 8 are SQLite-only via PRAGMA and handled there; Postgres gets
#      its coverage from model index=True / earlier Alembic where applicable.
# - Do NOT duplicate 9f2a or a8e indexes (checked against those files).
_INDEXES: list[tuple[str, str, list[str]]] = [
    # expenses — status was missing (category already covered by a8e)
    ("ix_expenses_status", "expenses", ["status"]),

    # payroll_records — no Alembic or runtime index existed before; all are new
    ("ix_payroll_records_created_at", "payroll_records", ["created_at"]),
    ("ix_payroll_records_status", "payroll_records", ["status"]),
    # single-column FK helpers (model declares index=True but DB lacked them)
    ("ix_payroll_records_employee_id", "payroll_records", ["employee_id"]),
    ("ix_payroll_records_user_id", "payroll_records", ["user_id"]),
    # composite (employee + period) — audit §5.3 "(employee+period)"
    ("ix_payroll_records_employee_period", "payroll_records", ["employee_id", "period_year", "period_month"]),

    # pos_shifts — status and composite user_id+opened_at already in a8e,
    # but single opened_at (date ordering without user_id filter) was missing
    ("ix_pos_shifts_opened_at", "pos_shifts", ["opened_at"]),
]


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    try:
        insp = sa.inspect(bind)
        return insp.has_table(table)
    except Exception:
        return False


def _existing_indexes(table: str) -> set[str]:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        return {ix["name"] for ix in insp.get_indexes(table)}
    except Exception:
        return set()


def upgrade() -> None:
    for name, table, cols in _INDEXES:
        if not _table_exists(table):
            continue
        if name not in _existing_indexes(table):
            try:
                op.create_index(name, table, cols)
            except Exception:
                # idempotent — if column missing or other race, skip
                pass


def downgrade() -> None:
    for name, table, _cols in reversed(_INDEXES):
        if not _table_exists(table):
            continue
        try:
            op.drop_index(name, table_name=table)
        except Exception:
            pass
