from sqlalchemy import Column, Integer, Date, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class BarberTimeOff(Base):
    __tablename__ = "barber_time_off"

    id = Column(Integer, primary_key=True, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False)
    off_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)

    barber = relationship("Barber")
