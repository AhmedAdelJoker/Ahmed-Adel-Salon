from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class ServiceSession(Base):
    __tablename__ = "service_sessions"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    barber_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    status = Column(String(30), nullable=False, default="active")
    notes = Column(Text, nullable=True)
    total_price = Column(Numeric(10, 2), nullable=False, default=0)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    appointment = relationship("Appointment")
    customer = relationship("Customer", back_populates="sessions")
    barber = relationship("Employee", back_populates="sessions")
    created_by_user = relationship("User")
    products = relationship("SessionProduct", back_populates="session", cascade="all, delete-orphan")
