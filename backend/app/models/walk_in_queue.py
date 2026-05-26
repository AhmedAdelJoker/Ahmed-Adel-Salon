from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class WalkInQueue(Base):
    __tablename__ = "walk_in_queue"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    ticket_no = Column(String(30), nullable=False, unique=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    requested_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    assigned_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    status = Column(String(20), nullable=False, default="waiting")
    queue_note = Column(Text, nullable=True)
    estimated_wait_minutes = Column(Integer, nullable=False, default=0)
    arrived_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    called_at = Column(DateTime(timezone=True), nullable=True)
    service_started_at = Column(DateTime(timezone=True), nullable=True)
    converted_session_id = Column(Integer, ForeignKey("service_sessions.id"), nullable=True)
    shift_id = Column(Integer, ForeignKey("pos_shifts.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    customer = relationship("Customer")
    service = relationship("Service")
    requested_employee = relationship("Employee", foreign_keys=[requested_employee_id])
    assigned_employee = relationship("Employee", foreign_keys=[assigned_employee_id])
    session = relationship("ServiceSession", foreign_keys=[converted_session_id])
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])



