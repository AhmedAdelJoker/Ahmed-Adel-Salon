from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class PayrollRecord(Base):
    __tablename__ = "payroll_records"
    id = Column(Integer, primary_key=True, index=True)
    
    # Linking to employee
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Snapshots for historical accuracy
    employee_name_snapshot = Column(String(255), nullable=False)
    role_snapshot = Column(String(100), nullable=True)
    
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    
    base_salary = Column(Numeric(10, 2), nullable=False, default=0)
    commission_amount = Column(Numeric(10, 2), nullable=False, default=0)
    bonus_amount = Column(Numeric(10, 2), nullable=False, default=0)
    deduction_amount = Column(Numeric(10, 2), nullable=False, default=0)
    advance_amount = Column(Numeric(10, 2), nullable=False, default=0)
    net_salary = Column(Numeric(10, 2), nullable=False, default=0)
    
    payment_method = Column(String(50), nullable=True)
    payment_date = Column(DateTime(timezone=True), nullable=True)
    
    status = Column(String(30), nullable=False, default="draft") # draft, calculated, paid, cancelled
    notes = Column(Text, nullable=True)
    
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="payroll_records")

    __table_args__ = (
        UniqueConstraint('employee_id', 'period_month', 'period_year', name='_employee_month_year_uc'),
    )



