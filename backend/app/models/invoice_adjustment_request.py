from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class InvoiceAdjustmentRequest(Base):
    __tablename__ = "invoice_adjustment_requests"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    request_type = Column(String(50), nullable=False)  # discount, payment_method, item, void, price
    reason = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    
    old_values = Column(JSON, nullable=True)
    requested_values = Column(JSON, nullable=True)
    
    status = Column(String(20), nullable=False, default="pending")  # pending, approved, rejected
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="adjustment_requests")
    requested_by = relationship("User", foreign_keys=[requested_by_user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])


