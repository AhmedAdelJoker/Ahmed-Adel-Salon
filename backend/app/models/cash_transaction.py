from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class CashTransaction(Base):
    __tablename__ = "cash_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_no = Column(String(50), unique=True, index=True)
    direction = Column(String(10), nullable=False)  # "in" or "out"
    type = Column(String(50), nullable=False)  # e.g., "manual_deposit", "invoice_payment"
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50), default="cash")
    reference_no = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_voided = Column(Boolean, default=False)
    transaction_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_by_user = relationship("User")
