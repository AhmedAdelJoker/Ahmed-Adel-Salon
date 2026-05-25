from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String(50), unique=True, nullable=False, index=True)

    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=True)

    payment_method = Column(String(30), nullable=False, default="cash")
    total_amount = Column(Numeric(10, 2), nullable=False, default=0)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    pdf_path = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    appointment = relationship("Appointment", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")
    barber = relationship("Barber", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])