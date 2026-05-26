from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class OfferService(Base):
    __tablename__ = "offer_services"

    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)

    offer = relationship("Offer", back_populates="offer_services")
    service = relationship("Service")
