from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True)
    amount = Column(Float, nullable=False)
    category = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    recipient_name = Column(String(255), nullable=True)
    payment_method = Column(String(50), nullable=True, default="cash")
    expense_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=True, index=True)
    
    status = Column(String(30), nullable=False, default="pending_audit") # pending_audit, approved, rejected, recorded
    invoice_image_url = Column(String(500), nullable=True)
    reference_type = Column(String(50), nullable=True)  # payroll/invoice/product/null
    reference_id = Column(Integer, nullable=True)
    internal_notes = Column(String(500), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    created_by_user = relationship("User")

    @property
    def created_by(self):
        return self.created_by_user
