from datetime import datetime
from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from app.db.base_class import Base


class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class LeaveType(str, enum.Enum):
    vacation = "vacation"
    sick = "sick"
    other = "other"


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False, default="vacation")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(Date, nullable=False, default=datetime.utcnow)

    employee = relationship("Employee")
