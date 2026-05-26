from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class PosShift(Base):
    __tablename__ = "pos_shifts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    status = Column(String(20), nullable=False, default="open")  # open, closed
    
    opened_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    
    opening_cash = Column(Numeric(10, 2), nullable=False, default=0)
    actual_closing_cash = Column(Numeric(10, 2), nullable=True)
    expected_closing_cash = Column(Numeric(10, 2), nullable=True)
    
    total_sales = Column(Numeric(10, 2), nullable=False, default=0)
    invoice_count = Column(Integer, nullable=False, default=0)
    discount_total = Column(Numeric(10, 2), nullable=False, default=0)
    
    opening_note = Column(Text, nullable=True)
    closing_note = Column(Text, nullable=True)
    
    user = relationship("User", backref="pos_shifts")
