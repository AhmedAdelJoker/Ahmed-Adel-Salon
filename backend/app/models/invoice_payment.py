from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    
    payment_method = Column(String(30), nullable=False, default="cash") # cash, vodafone_cash, instapay, bank_card
    amount = Column(Numeric(10, 2), nullable=False, default=0)
    shift_id = Column(Integer, ForeignKey("pos_shifts.id"), nullable=True)
    
    reference_no = Column(String(100), nullable=True)
    external_channel = Column(String(100), nullable=True) # e.g. Vodafone Cash Transaction ID
    
    received_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    invoice = relationship("Invoice", back_populates="payments")
    received_by_user = relationship("User")
    shift = relationship("PosShift")



