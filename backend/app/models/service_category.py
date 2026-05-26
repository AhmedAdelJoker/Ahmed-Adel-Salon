from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class ServiceCategory(Base):
    __tablename__ = "service_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    name_ar = Column(String(255), nullable=True)
    icon = Column(String(100), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    services = relationship("Service", back_populates="category_rel")
