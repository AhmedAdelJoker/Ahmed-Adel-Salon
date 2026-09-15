from sqlalchemy import Column, Integer, String, DateTime, Numeric, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    notes = Column(String(1000), nullable=True)
    
    # Loyalty Fields
    loyalty_points = Column(Numeric(10, 2), nullable=False, default=0)
    lifetime_spend = Column(Numeric(12, 2), nullable=False, default=0)
    visits_count = Column(Integer, nullable=False, default=0)
    current_tier = Column(String(50), nullable=False, default="Bronze") # Bronze, Silver, Gold
    loyalty_points_earned_at = Column(DateTime(timezone=True), nullable=True)  # آخر كسب نقاط — أساس حساب انتهاء الصلاحية
    cancellation_count = Column(Integer, nullable=False, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    archive_reason = Column(String(500), nullable=True)

    appointments = relationship("Appointment", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")
    sessions = relationship("ServiceSession", back_populates="customer")
    deleted_by = relationship("User", foreign_keys=[deleted_by_user_id])
