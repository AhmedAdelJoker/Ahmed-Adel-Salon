from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    name_ar = Column(String(255), nullable=True)
    name_en = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    description_ar = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    original_price = Column(Numeric(10, 2), nullable=True)
    offer_price = Column(Numeric(10, 2), nullable=False, default=0)
    discount_percentage = Column(Numeric(10, 2), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_public = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    offer_services = relationship(
        "OfferService",
        back_populates="offer",
        cascade="all, delete-orphan",
    )
    offer_products = relationship(
        "OfferProduct",
        back_populates="offer",
        cascade="all, delete-orphan",
    )
