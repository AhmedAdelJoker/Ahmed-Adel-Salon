from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.db.base_class import Base


class BusinessSettings(Base):
    __tablename__ = "business_settings"

    id = Column(Integer, primary_key=True, index=True)

    salon_name = Column(String(255), nullable=False, default="SalonPro")
    shop_phone = Column(String(30), nullable=True)
    shop_whatsapp = Column(String(30), nullable=True)
    address = Column(String(500), nullable=True)
    receipt_footer = Column(Text, nullable=True)
    currency = Column(String(10), nullable=False, default="EGP")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=True,
        onupdate=func.now(),
    )