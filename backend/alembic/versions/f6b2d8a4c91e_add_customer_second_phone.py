"""add_customer_second_phone

Revision ID: f6b2d8a4c91e
Revises: a3c8e2f5d9b1
Create Date: 2026-10-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6b2d8a4c91e'
down_revision: Union[str, None] = 'a3c8e2f5d9b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('second_phone', sa.VARCHAR(length=30), nullable=True))
        batch_op.create_index('ix_customers_second_phone', ['second_phone'])


def downgrade() -> None:
    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.drop_index('ix_customers_second_phone')
        batch_op.drop_column('second_phone')
