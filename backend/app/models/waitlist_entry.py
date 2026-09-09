from sqlalchemy import Column, Integer, String, Date, Time, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    barber_id = Column(Integer, ForeignKey("employees.id"), nullable=True)  # NULL = any barber
    preferred_date = Column(Date, nullable=False)
    preferred_time_start = Column(Time, nullable=True)  # Earliest acceptable time
    preferred_time_end = Column(Time, nullable=True)  # Latest acceptable time

    service_ids = Column(Text, nullable=True)  # JSON string of service IDs
    notes = Column(Text, nullable=True)

    status = Column(String(20), nullable=False, default="waiting")  # waiting, notified, booked, expired, cancelled
    priority = Column(Integer, nullable=False, default=0)  # Higher = more priority

    notification_sent = Column(Boolean, nullable=False, default=False)
    notification_sent_at = Column(DateTime(timezone=True), nullable=True)

    converted_to_appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    customer = relationship("Customer")
    barber = relationship("Employee")
    appointment = relationship("Appointment")
