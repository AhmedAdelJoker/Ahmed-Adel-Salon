from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(255), nullable=True)
    sku = Column(String(100), nullable=True)
    company_name = Column(String(255), nullable=True)
    quantity = Column(Numeric(10, 2), nullable=False, default=0)
    unit = Column(String(50), nullable=False, default="g")
    cost_price = Column(Numeric(10, 2), nullable=False, default=0)
    sell_price = Column(Numeric(10, 2), nullable=True)
    min_quantity_alert = Column(Numeric(10, 2), nullable=False, default=0)
    weight = Column(Numeric(10, 2), nullable=True)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    inventory_logs = relationship("InventoryLog", back_populates="product", cascade="all, delete-orphan")
    service_products = relationship("ServiceProduct", back_populates="product", cascade="all, delete-orphan")
