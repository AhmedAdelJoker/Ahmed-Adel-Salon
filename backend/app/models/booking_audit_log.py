from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class BookingAuditLog(Base):
    __tablename__ = "booking_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False) # e.g., "CREATE", "UPDATE", "STATUS_CHANGE", "CANCEL"
    changes = Column(Text, nullable=True) # JSON string of changed fields: {"old": {...}, "new": {...}}
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    appointment = relationship("Appointment")
    user = relationship("User")
