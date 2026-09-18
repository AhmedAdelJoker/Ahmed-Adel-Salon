"""add_phase2_critical_indexes

Phase 2 — Backend/DB Optimization. Adds ONLY the indexes that are
still missing after runtime_schema.py + the prior 9f2a1c4e7b01
migration have been applied.

Idempotent: skips indexes that already exist.

Missing indexes added:
- service_sessions.status, (barber_id, status)
- pos_shifts.status, (user_id, opened_at)
- activity_logs.created_at, (user_id, created_at)
- expenses.category + (category, created_at)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8e1c4f29b3d'
down_revision: Union[str, None] = '7c3d9a1f2e44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_INDEXES: list[tuple[str, str, list[str]]] = [
    # service_sessions — only the id index existed before this migration
    ("ix_service_sessions_status", "service_sessions", ["status"]),
    ("ix_service_sessions_barber_id_status", "service_sessions", ["barber_id", "status"]),
    # pos_shifts — only the id index existed before this migration
    ("ix_pos_shifts_status", "pos_shifts", ["status"]),
    ("ix_pos_shifts_user_id_opened_at", "pos_shifts", ["user_id", "opened_at"]),
    # activity_logs — only the id index existed before this migration
    ("ix_activity_logs_created_at", "activity_logs", ["created_at"]),
    ("ix_activity_logs_user_id_created_at", "activity_logs", ["user_id", "created_at"]),
    # expenses — composite category+date index for category reports
    ("ix_expenses_category", "expenses", ["category"]),
    ("ix_expenses_category_created_at", "expenses", ["category", "created_at"]),
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
