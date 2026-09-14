from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func

from app.db.base_class import Base


class ReportSchedule(Base):
    """Periodic financial report delivery (daily / weekly / monthly)."""

    __tablename__ = "report_schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, default="التقرير المالي الدوري")
    # daily | weekly | monthly
    frequency = Column(String(20), nullable=False, default="daily", index=True)
    # notification | whatsapp | both
    channel = Column(String(20), nullable=False, default="notification")
    target_phone = Column(String(30), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # ok | error | never
    last_status = Column(String(20), nullable=False, default="never")
    last_summary = Column(Text, nullable=True)
    # Relative URL of the last generated PDF, e.g. /uploads/scheduled_reports/x.pdf
    last_pdf_url = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        onupdate=func.now(),
    )
