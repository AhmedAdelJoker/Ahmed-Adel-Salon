"""remove smtp and twilio/sms fields from business_settings

Revision ID: 20260327_04
Revises: 20260327_03
Create Date: 2026-03-27 22:10:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260327_04"
down_revision = "20260326_03"  # <-- ربطه بالملف الثالث الفعلي المتاح لديك
branch_labels = None
depends_on = None


def upgrade():
    # إزالة الحقول غير المطلوبة بعد التحويل إلى Meta Cloud API فقط
    for column_name in [
        "whatsapp_sender_phone",
        "default_notification_channel",
        "smtp_host",
        "smtp_port",
        "smtp_username",
        "smtp_password",
    ]:
        try:
            op.drop_column("business_settings", column_name)
        except Exception:
            pass


def downgrade():
    op.add_column("business_settings", sa.Column("whatsapp_sender_phone", sa.String(length=50), nullable=True))
    op.add_column("business_settings", sa.Column("default_notification_channel", sa.String(length=20), nullable=False, server_default="whatsapp"))
    op.add_column("business_settings", sa.Column("smtp_host", sa.String(length=255), nullable=True))
    op.add_column("business_settings", sa.Column("smtp_port", sa.Integer(), nullable=False, server_default="587"))
    op.add_column("business_settings", sa.Column("smtp_username", sa.String(length=255), nullable=True))
    op.add_column("business_settings", sa.Column("smtp_password", sa.String(length=255), nullable=True))