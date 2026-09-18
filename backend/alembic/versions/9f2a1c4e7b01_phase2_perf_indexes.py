"""phase2_perf_indexes_appointments_invoices_customers

Revision ID: 9f2a1c4e7b01
Revises: 1900e37818c4
Create Date: 2026-09-17

Adds critical indexes for 1M-row scale:
- appointments(barber_id, appointment_date), (barber_id, appointment_date, status), customer_id, status
- invoices(barber_id, created_at), customer_id, (created_at, is_draft), is_draft
- customers(is_deleted), visits_count, created_at
Idempotent: skips indexes that already exist (SQLite/Postgres).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f2a1c4e7b01'
down_revision: Union[str, None] = '1900e37818c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEXES: list[tuple[str, str, list[str]]] = [
    ("ix_appointments_barber_date", "appointments", ["barber_id", "appointment_date"]),
    ("ix_appointments_barber_date_status", "appointments", ["barber_id", "appointment_date", "status"]),
    ("ix_appointments_customer", "appointments", ["customer_id"]),
    ("ix_appointments_status", "appointments", ["status"]),
    ("ix_invoices_barber_created", "invoices", ["barber_id", "created_at"]),
    ("ix_invoices_customer", "invoices", ["customer_id"]),
    ("ix_invoices_created_draft", "invoices", ["created_at", "is_draft"]),
    ("ix_invoices_is_draft", "invoices", ["is_draft"]),
    ("ix_customers_is_deleted", "customers", ["is_deleted"]),
    ("ix_customers_visits", "customers", ["visits_count"]),
    ("ix_customers_created", "customers", ["created_at"]),
]


def _existing_indexes(table: str) -> set[str]:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        return {ix["name"] for ix in insp.get_indexes(table)}
    except Exception:
        return set()


def upgrade() -> None:
    for name, table, cols in _INDEXES:
        if name not in _existing_indexes(table):
            op.create_index(name, table, cols)


def downgrade() -> None:
    for name, table, _cols in reversed(_INDEXES):
        try:
            op.drop_index(name, table_name=table)
        except Exception:
            pass
