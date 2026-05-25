from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class SessionProduct(Base):
    __tablename__ = "session_products"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("service_sessions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity_used = Column(Numeric(10, 2), nullable=False, default=1)

    session = relationship("ServiceSession", back_populates="products")
    product = relationship("Product")
