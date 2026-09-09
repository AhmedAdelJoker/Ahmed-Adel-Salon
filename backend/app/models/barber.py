from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Barber(Base):
    """
    Legacy Barber model. 
    Functionality moved to Employee model.
    This remains for DB compatibility until fully migrated.
    """
    __tablename__ = "barbers"

    id = Column(Integer, primary_key=True, index=True)
    display_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships removed to avoid conflicts with Employee model
    # users = relationship("User", back_populates="barber")
    # appointments = relationship("Appointment", back_populates="barber")
    # invoices = relationship("Invoice", back_populates="barber")
    # sessions = relationship("ServiceSession", back_populates="barber")
