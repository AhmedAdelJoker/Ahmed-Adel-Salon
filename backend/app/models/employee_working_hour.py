from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, Time, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class EmployeeWorkingHour(Base):
    __tablename__ = "employee_working_hours"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    employee = relationship("Employee", back_populates="working_hours")



