from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class EmployeeDocument(Base):
    __tablename__ = "employee_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    file_url = Column(String(255), nullable=False)
    storage_key = Column(String(255), nullable=True, unique=True, index=True)
    file_type = Column(String(50), nullable=True) # ID, Contract, Certificate, Health, etc.
    expiry_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    employee = relationship("Employee", backref="documents")
