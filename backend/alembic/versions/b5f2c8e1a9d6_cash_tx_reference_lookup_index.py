"""Lookup index for cash transactions created from expenses.

Revision ID: b5f2c8e1a9d6
Revises: a4f7e9c0d1b3
Create Date: 2026-11-13

`find_existing_cash_transaction()` filters on
(reference_type, reference_id, type) on every expense create/approve, and
`is_voided` on top of that. Without this index the query scans the whole
cash ledger once the box has any history.

Guarded on purpose: the live SQLite database is maintained by
`ensure_runtime_schema`, not by Alembic, and `Base.metadata.create_all`
creates the same index on fresh SQLite files. Skipping when the index
already exists keeps `alembic upgrade head` a no-op there instead of
crashing on a duplicate index.
"""

from alembic import op
from sqlalchemy import inspect

revision = "b5f2c8e1a9d6"
down_revision = "a4f7e9c0d1b3"
branch_labels = None
depends_on = None

INDEX_NAME = "ix_cash_transactions_reference_lookup"


def upgrade() -> None:
    bind = op.get_bind()
    existing = {
        idx["name"]
        for idx in inspect(bind).get_indexes("cash_transactions")
    }
    if INDEX_NAME not in existing:
        op.create_index(
            INDEX_NAME,
            "cash_transactions",
            ["reference_type", "reference_id", "type"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    existing = {
        idx["name"]
        for idx in inspect(bind).get_indexes("cash_transactions")
    }
    if INDEX_NAME in existing:
        op.drop_index(INDEX_NAME, table_name="cash_transactions")
