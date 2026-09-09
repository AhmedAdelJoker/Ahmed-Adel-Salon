"""add_composite_index_customers_phone_is_deleted

Revision ID: 1900e37818c4
Revises: da028f4275cb
Create Date: 2026-08-07 13:01:10.743689

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1900e37818c4'
down_revision: Union[str, None] = 'da028f4275cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create composite index for faster phone + is_deleted lookups (reactivation check)
    op.create_index('ix_customers_phone_is_deleted', 'customers', ['phone', 'is_deleted'])


def downgrade() -> None:
    op.drop_index('ix_customers_phone_is_deleted', table_name='customers')