"""unify_barber_to_employee

Revision ID: 0de75d6f3a31
Revises: 3e00e10485d0
Create Date: 2026-06-02 05:46:18.947865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0de75d6f3a31'
down_revision: Union[str, None] = '3e00e10485d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        # Fix booking_source default and add new foreign key
        batch_op.alter_column('booking_source', server_default=sa.text("'shop'"))
        batch_op.create_foreign_key('fk_appointments_barber_employee', 'employees', ['barber_id'], ['id'])

    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.create_foreign_key('fk_invoices_barber_employee', 'employees', ['barber_id'], ['id'])

    with op.batch_alter_table('service_sessions', schema=None) as batch_op:
        batch_op.create_foreign_key('fk_service_sessions_barber_employee', 'employees', ['barber_id'], ['id'])

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_foreign_key('fk_users_barber_employee', 'employees', ['barber_id'], ['id'])

def downgrade() -> None:
    pass
