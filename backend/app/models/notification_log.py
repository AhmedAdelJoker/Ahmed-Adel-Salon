from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)

    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    channel = Column(String(20), nullable=False)
    message_type = Column(String(50), nullable=False)
    recipient_phone = Column(String(30), nullable=False)

    provider_name = Column(String(50), nullable=True)
    provider_message_id = Column(String(255), nullable=True)

    payload = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="queued")
    failure_reason = Column(Text, nullable=True)

    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    appointment = relationship("Appointment")
    invoice = relationship("Invoice")

    created_by_user = relationship(
        "User",
        back_populates="notification_logs",
        foreign_keys=[created_by_user_id],
    )