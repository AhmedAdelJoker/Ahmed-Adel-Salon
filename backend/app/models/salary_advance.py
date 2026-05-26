from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class SalaryAdvance(Base):
    __tablename__ = "salary_advances"
    id = Column(Integer, primary_key=True, index=True)
    
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(Text, nullable=True)
    advance_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Tracking status
    is_deducted = Column(Boolean, default=False, nullable=False)
    payroll_record_id = Column(Integer, ForeignKey("payroll_records.id"), nullable=True)
    
    # Metadata
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", backref="salary_advances")
    payroll_record = relationship("PayrollRecord", backref="deducted_advances")



