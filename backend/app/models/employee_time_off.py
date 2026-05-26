from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, Date, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class EmployeeTimeOff(Base):
    __tablename__ = "employee_time_off"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    off_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)

    employee = relationship("Employee", back_populates="time_offs")



