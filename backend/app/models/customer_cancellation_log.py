from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class CustomerCancellationLog(Base):
    __tablename__ = "customer_cancellation_logs"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    appointment_id = Column(Integer, nullable=True) # Kept for reference, but not a strict FK since appointment can be deleted
    cancellation_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reason = Column(Text, nullable=True)
    cancelled_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    customer = relationship("Customer")
    user = relationship("User")
