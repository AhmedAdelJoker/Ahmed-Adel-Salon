from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class ServiceProduct(Base):
    __tablename__ = "service_products"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    amount_used = Column(Numeric(10, 2), nullable=False, default=1)

    product = relationship("Product", back_populates="service_products")
    service = relationship("Service", back_populates="ingredients")
