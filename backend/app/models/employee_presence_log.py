from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class EmployeePresenceLog(Base):
    __tablename__ = "employee_presence_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="presence_logs")



