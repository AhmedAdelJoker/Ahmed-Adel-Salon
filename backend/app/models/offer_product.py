from sqlalchemy import Column, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class OfferProduct(Base):
    __tablename__ = "offer_products"

    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1)

    offer = relationship("Offer", back_populates="offer_products")
    product = relationship("Product")
