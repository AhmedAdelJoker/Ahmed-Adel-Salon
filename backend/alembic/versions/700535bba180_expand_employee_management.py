"""expand_employee_management

Revision ID: 700535bba180
Revises: 66176a4d7061
Create Date: 2026-05-08 11:08:52.030312

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '700535bba180'
down_revision: Union[str, None] = '66176a4d7061'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Rename barbers to employees
    if 'barbers' in tables:
        op.rename_table('barbers', 'employees')
    
    # 2. Add columns to employees
    columns = [c['name'] for c in inspector.get_columns('employees')]
    if 'full_name' not in columns:
        with op.batch_alter_table('employees', schema=None) as batch_op:
            batch_op.add_column(sa.Column('full_name', sa.String(length=255), nullable=True))
            batch_op.add_column(sa.Column('phone_primary', sa.String(length=30), nullable=True))
            batch_op.add_column(sa.Column('phone_secondary', sa.String(length=30), nullable=True))
            batch_op.add_column(sa.Column('profile_image_url', sa.String(length=255), nullable=True))
            batch_op.add_column(sa.Column('national_id', sa.String(length=20), nullable=True))
            batch_op.add_column(sa.Column('birth_date', sa.DateTime(), nullable=True))
            batch_op.add_column(sa.Column('governorate', sa.String(length=100), nullable=True))
            batch_op.add_column(sa.Column('city', sa.String(length=100), nullable=True))
            batch_op.add_column(sa.Column('detailed_address', sa.Text(), nullable=True))
            batch_op.add_column(sa.Column('personal_notes', sa.Text(), nullable=True))
            batch_op.add_column(sa.Column('job_title', sa.String(length=50), server_default='barber', nullable=False))
            batch_op.add_column(sa.Column('department', sa.String(length=100), nullable=True))
            batch_op.add_column(sa.Column('employment_type', sa.String(length=30), server_default='full_time', nullable=False))
            batch_op.add_column(sa.Column('hire_date', sa.DateTime(), server_default=sa.func.now(), nullable=True))
            batch_op.add_column(sa.Column('status', sa.String(length=30), server_default='active', nullable=False))
            batch_op.add_column(sa.Column('work_days_json', sa.JSON(), nullable=True))
            batch_op.add_column(sa.Column('work_hours_json', sa.JSON(), nullable=True))
            batch_op.add_column(sa.Column('show_in_pos', sa.Boolean(), server_default='1', nullable=False))
            batch_op.add_column(sa.Column('show_in_booking', sa.Boolean(), server_default='1', nullable=False))
            batch_op.add_column(sa.Column('base_salary', sa.Numeric(precision=10, scale=2), server_default='0.0', nullable=False))
            batch_op.add_column(sa.Column('commission_rate', sa.Numeric(precision=5, scale=2), server_default='0.0', nullable=False))
            batch_op.add_column(sa.Column('fixed_bonus', sa.Numeric(precision=10, scale=2), server_default='0.0', nullable=False))
            batch_op.add_column(sa.Column('default_deductions', sa.Numeric(precision=10, scale=2), server_default='0.0', nullable=False))
            batch_op.add_column(sa.Column('payment_method', sa.String(length=30), nullable=True))
            batch_op.add_column(sa.Column('wallet_number', sa.String(length=30), nullable=True))
            batch_op.add_column(sa.Column('bank_account', sa.String(length=100), nullable=True))
            batch_op.add_column(sa.Column('assistant_of_barber_id', sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column('assistant_tasks_json', sa.JSON(), nullable=True))
            batch_op.add_column(sa.Column('receives_commission', sa.Boolean(), server_default='0', nullable=False))
            batch_op.add_column(sa.Column('assistant_commission_rate', sa.Numeric(precision=5, scale=2), server_default='0.0', nullable=False))
            batch_op.add_column(sa.Column('has_login_account', sa.Boolean(), server_default='0', nullable=False))
            batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))
            
            batch_op.create_foreign_key('fk_employees_assistant_of_barber_id', 'employees', ['assistant_of_barber_id'], ['id'])
            batch_op.create_foreign_key('fk_employees_user_id', 'users', ['user_id'], ['id'])

        # 3. Data Migration for employees
        op.execute("UPDATE employees SET full_name = display_name, phone_primary = phone, profile_image_url = photo_url, personal_notes = bio_ar")
        op.execute("UPDATE employees SET commission_rate = commission_value")

    # 4. Rename related tables
    if 'barber_working_hours' in tables:
        op.rename_table('barber_working_hours', 'employee_working_hours')
    if 'barber_time_off' in tables:
        op.rename_table('barber_time_off', 'employee_time_off')
    if 'barber_presence_logs' in tables:
        op.rename_table('barber_presence_logs', 'employee_presence_logs')

    # 5. Update foreign keys in other tables
    
    # users
    user_columns = [c['name'] for c in inspector.get_columns('users')]
    if 'employee_id' not in user_columns:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('employee_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_users_employee_id_employees', 'employees', ['employee_id'], ['id'])
        if 'barber_id' in user_columns:
            op.execute("UPDATE users SET employee_id = barber_id")
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.drop_column('barber_id')

    # appointments
    app_columns = [c['name'] for c in inspector.get_columns('appointments')]
    if 'employee_id' not in app_columns:
        with op.batch_alter_table('appointments', schema=None) as batch_op:
            # Drop ALL indexes that use barber_id or requested_barber_id
            for idx in inspector.get_indexes('appointments'):
                if 'barber_id' in idx['column_names'] or 'requested_barber_id' in idx['column_names']:
                    batch_op.drop_index(idx['name'])
            
            batch_op.add_column(sa.Column('employee_id', sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column('requested_employee_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_appointments_employee_id_employees', 'employees', ['employee_id'], ['id'])
            batch_op.create_foreign_key('fk_appointments_requested_employee_id_employees', 'employees', ['requested_employee_id'], ['id'])
            batch_op.create_index('idx_app_employee_date', ['employee_id', 'appointment_date'])
            batch_op.create_index(op.f('ix_appointments_employee_id'), ['employee_id'], unique=False)
            batch_op.create_index(op.f('ix_appointments_requested_employee_id'), ['requested_employee_id'], unique=False)
            
        if 'barber_id' in app_columns:
            op.execute("UPDATE appointments SET employee_id = barber_id")
            if 'requested_barber_id' in app_columns:
                op.execute("UPDATE appointments SET requested_employee_id = requested_barber_id")
            with op.batch_alter_table('appointments', schema=None) as batch_op:
                batch_op.drop_column('barber_id')
                if 'requested_barber_id' in app_columns:
                    batch_op.drop_column('requested_barber_id')

    # invoices
    inv_columns = [c['name'] for c in inspector.get_columns('invoices')]
    if 'employee_id' not in inv_columns:
        with op.batch_alter_table('invoices', schema=None) as batch_op:
            for idx in inspector.get_indexes('invoices'):
                if 'barber_id' in idx['column_names']:
                    batch_op.drop_index(idx['name'])
            batch_op.add_column(sa.Column('employee_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_invoices_employee_id_employees', 'employees', ['employee_id'], ['id'])
            batch_op.create_index(op.f('ix_invoices_employee_id'), ['employee_id'], unique=False)
        if 'barber_id' in inv_columns:
            op.execute("UPDATE invoices SET employee_id = barber_id")
            with op.batch_alter_table('invoices', schema=None) as batch_op:
                batch_op.drop_column('barber_id')

    # invoice_items
    ii_columns = [c['name'] for c in inspector.get_columns('invoice_items')]
    if 'employee_id' not in ii_columns:
        with op.batch_alter_table('invoice_items', schema=None) as batch_op:
            batch_op.add_column(sa.Column('employee_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_invoice_items_employee_id_employees', 'employees', ['employee_id'], ['id'])
        if 'barber_id' in ii_columns:
            op.execute("UPDATE invoice_items SET employee_id = barber_id")
            with op.batch_alter_table('invoice_items', schema=None) as batch_op:
                batch_op.drop_column('barber_id')

    # payroll_records
    pr_columns = [c['name'] for c in inspector.get_columns('payroll_records')]
    if 'user_id' not in pr_columns:
        with op.batch_alter_table('payroll_records', schema=None) as batch_op:
            batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_payroll_records_user_id_users', 'users', ['user_id'], ['id'])
    
    if 'new_employee_id' not in pr_columns and 'employee_id' in pr_columns and 'barber_id' in pr_columns:
        with op.batch_alter_table('payroll_records', schema=None) as batch_op:
            batch_op.add_column(sa.Column('new_employee_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_payroll_records_employee_id_employees', 'employees', ['new_employee_id'], ['id'])
        
        op.execute("UPDATE payroll_records SET user_id = employee_id, new_employee_id = barber_id")
        
        with op.batch_alter_table('payroll_records', schema=None) as batch_op:
            batch_op.drop_column('employee_id')
            batch_op.drop_column('barber_id')
            batch_op.alter_column('new_employee_id', new_column_name='employee_id')

    # reviews
    rev_columns = [c['name'] for c in inspector.get_columns('reviews')]
    if 'employee_id' not in rev_columns:
        with op.batch_alter_table('reviews', schema=None) as batch_op:
            batch_op.add_column(sa.Column('employee_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_reviews_employee_id_employees', 'employees', ['employee_id'], ['id'])
        if 'barber_id' in rev_columns:
            op.execute("UPDATE reviews SET employee_id = barber_id")
            with op.batch_alter_table('reviews', schema=None) as batch_op:
                batch_op.drop_column('barber_id')

    # service_sessions
    ss_columns = [c['name'] for c in inspector.get_columns('service_sessions')]
    if 'employee_id' not in ss_columns:
        with op.batch_alter_table('service_sessions', schema=None) as batch_op:
            batch_op.add_column(sa.Column('employee_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_service_sessions_employee_id_employees', 'employees', ['employee_id'], ['id'])
        if 'barber_id' in ss_columns:
            op.execute("UPDATE service_sessions SET employee_id = barber_id")
            with op.batch_alter_table('service_sessions', schema=None) as batch_op:
                batch_op.drop_column('barber_id')

    # walk_in_queue
    wi_columns = [c['name'] for c in inspector.get_columns('walk_in_queue')]
    if 'requested_employee_id' not in wi_columns:
        with op.batch_alter_table('walk_in_queue', schema=None) as batch_op:
            batch_op.add_column(sa.Column('requested_employee_id', sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column('assigned_employee_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_walk_in_queue_requested_employee_id_employees', 'employees', ['requested_employee_id'], ['id'])
            batch_op.create_foreign_key('fk_walk_in_queue_assigned_employee_id_employees', 'employees', ['assigned_employee_id'], ['id'])
        if 'requested_barber_id' in wi_columns:
            op.execute("UPDATE walk_in_queue SET requested_employee_id = requested_barber_id")
            if 'assigned_barber_id' in wi_columns:
                op.execute("UPDATE walk_in_queue SET assigned_employee_id = assigned_barber_id")
            with op.batch_alter_table('walk_in_queue', schema=None) as batch_op:
                batch_op.drop_column('requested_barber_id')
                if 'assigned_barber_id' in wi_columns:
                    batch_op.drop_column('assigned_barber_id')

    # employee_working_hours, employee_time_off, employee_presence_logs
    if 'employee_working_hours' in tables:
        ewh_columns = [c['name'] for c in inspector.get_columns('employee_working_hours')]
        if 'barber_id' in ewh_columns:
            with op.batch_alter_table('employee_working_hours', schema=None) as batch_op:
                batch_op.alter_column('barber_id', new_column_name='employee_id')
    if 'employee_time_off' in tables:
        eto_columns = [c['name'] for c in inspector.get_columns('employee_time_off')]
        if 'barber_id' in eto_columns:
            with op.batch_alter_table('employee_time_off', schema=None) as batch_op:
                batch_op.alter_column('barber_id', new_column_name='employee_id')
    if 'employee_presence_logs' in tables:
        epl_columns = [c['name'] for c in inspector.get_columns('employee_presence_logs')]
        if 'barber_id' in epl_columns:
            with op.batch_alter_table('employee_presence_logs', schema=None) as batch_op:
                batch_op.alter_column('barber_id', new_column_name='employee_id')

def downgrade() -> None:
    pass
