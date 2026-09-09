"""Add shift_auto_close_grace_period to business_settings

Revision ID: dd86889d3d74
Revises: b0a62289ac98
Create Date: 2026-08-06 19:35:28.835816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd86889d3d74'
down_revision: Union[str, None] = 'b0a62289ac98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the new column with a default value (30 minutes) so existing rows are valid.
    with op.batch_alter_table('business_settings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'shift_auto_close_grace_period',
                sa.Integer(),
                nullable=False,
                server_default=sa.text('30'),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('business_settings', schema=None) as batch_op:
        batch_op.drop_column('shift_auto_close_grace_period')
