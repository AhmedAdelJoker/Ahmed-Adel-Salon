from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.db.base_class import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, nullable=True, index=True)
    user_name = Column(String, nullable=True)

    action = Column(String, nullable=False, index=True)
    entity_name = Column(String, nullable=False, index=True)
    entity_id = Column(String, nullable=True, index=True)

    old_values = Column(Text, nullable=True)
    new_values = Column(Text, nullable=True)

    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    device_name = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)



