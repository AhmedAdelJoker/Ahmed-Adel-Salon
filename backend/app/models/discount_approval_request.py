from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, Numeric, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class DiscountApprovalRequest(Base):
    __tablename__ = "discount_approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    requested_discount_amount = Column(Numeric(10, 2), nullable=False, default=0)
    reason = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    decision_note = Column(Text, nullable=True)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    invoice = relationship("Invoice", back_populates="discount_approval_requests")
    requested_by_user = relationship("User", foreign_keys=[requested_by_user_id])
    approved_by_user = relationship("User", foreign_keys=[approved_by_user_id])



