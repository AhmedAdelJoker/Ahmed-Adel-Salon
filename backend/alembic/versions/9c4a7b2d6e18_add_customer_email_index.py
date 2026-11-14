"""add_customer_email_index

Revision ID: 9c4a7b2d6e18
Revises: f6b2d8a4c91e
Create Date: 2026-10-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c4a7b2d6e18'
down_revision: Union[str, None] = 'f6b2d8a4c91e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.create_index('ix_customers_email', ['email'])


def downgrade() -> None:
    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.drop_index('ix_customers_email')
