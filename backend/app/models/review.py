from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), unique=True, nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    rating = Column(Float, nullable=False) # 1.0 to 5.0
    comment = Column(Text, nullable=True)
    
    customer_name_snapshot = Column(String(200), nullable=True)
    is_public = Column(Boolean, default=False) # Requires approval to show on homepage
    is_verified_visit = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    appointment = relationship("Appointment")
    customer = relationship("Customer")
    employee = relationship("Employee", back_populates="reviews")



