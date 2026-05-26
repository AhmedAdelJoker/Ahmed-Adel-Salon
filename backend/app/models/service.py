from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False)
    name_ar = Column(String(255), nullable=True)
    name_en = Column(String(255), nullable=True)
    description_ar = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    category = Column(String(255), nullable=True)
    category_id = Column(Integer, ForeignKey("service_categories.id"), nullable=True)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=False, default=30)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    appointment_services = relationship("AppointmentService", back_populates="service")
    invoice_items = relationship("InvoiceItem", back_populates="service")
    category_rel = relationship("ServiceCategory", back_populates="services")
    ingredients = relationship(
        "ServiceProduct",
        back_populates="service",
        cascade="all, delete-orphan",
    )
