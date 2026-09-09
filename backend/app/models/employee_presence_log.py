from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Numeric, Text, Date, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class EmployeePresenceLog(Base):
    __tablename__ = "employee_presence_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False)  # in, out, break, break_end
    is_late = Column(Boolean, default=False, nullable=False)
    late_minutes = Column(Integer, default=0, nullable=False)
    late_reason = Column(String(500), nullable=True)
    source = Column(String(30), default="manual")  # manual, biometric, import, auto
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="presence_logs")


class AttendanceArchive(Base):
    """Monthly attendance archive with summary data."""
    __tablename__ = "attendance_archives"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    year_month = Column(String(7), nullable=False)  # YYYY-MM format
    total_work_days = Column(Integer, default=0)
    total_work_hours = Column(Float, default=0.0)
    total_late_count = Column(Integer, default=0)
    total_late_minutes = Column(Integer, default=0)
    total_break_minutes = Column(Integer, default=0)
    avg_daily_hours = Column(Float, default=0.0)
    penalty_amount = Column(Numeric(10, 2), default=0)
    archive_data = Column(Text, nullable=True)  # JSON string with daily details
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="attendance_archives")


class AttendancePenalty(Base):
    """Track penalties for late arrivals."""
    __tablename__ = "attendance_penalties"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    late_minutes = Column(Integer, default=0)
    reason = Column(String(500), nullable=True)
    penalty_amount = Column(Numeric(10, 2), default=0)
    is_excused = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="attendance_penalties")
