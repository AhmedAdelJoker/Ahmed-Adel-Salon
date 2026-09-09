from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Time,
    Text,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    barber_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    appointment_date = Column(Date, nullable=False)
    appointment_time = Column(Time, nullable=False)

    status = Column(String(30), nullable=False, default="pending")
    notes = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    total_estimated_price = Column(Numeric(10, 2), nullable=False, default=0)
    total_estimated_duration_minutes = Column(Integer, nullable=False, default=0)

    confirmation_sent = Column(Boolean, nullable=False, default=False)
    reminder_24h_sent = Column(Boolean, nullable=False, default=False)
    reminder_2h_sent = Column(Boolean, nullable=False, default=False)

    converted_to_session = Column(Boolean, nullable=False, default=False)
    session_id = Column(Integer, nullable=True)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    booking_source = Column(String(50), default="shop") # 'shop' or 'online'

    customer = relationship("Customer", back_populates="appointments")
    barber = relationship("Employee", back_populates="appointments")

    services = relationship(
        "AppointmentService",
        back_populates="appointment",
        cascade="all, delete-orphan",
    )

    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id])

    invoices = relationship("Invoice", back_populates="appointment")

    sessions = relationship("ServiceSession", back_populates="appointment")