from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base


class ShopSettings(Base):
    __tablename__ = "shop_settings"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String, nullable=False, default="Salon Management Pro")
    legal_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    whatsapp = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    tax_number = Column(String, nullable=True)
    commercial_register = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    invoice_footer = Column(String, nullable=True)

    currency_code = Column(String, nullable=False, default="EGP")
    currency_symbol = Column(String, nullable=False, default="ج.م")
    default_language = Column(String, nullable=False, default="ar")
    default_direction = Column(String, nullable=False, default="rtl")
    receipt_width = Column(String, nullable=False, default="80mm")

    tax_enabled = Column(Integer, nullable=False, default=0)
    tax_rate = Column(Float, nullable=False, default=0)
    discount_enabled = Column(Integer, nullable=False, default=1)
    allow_negative_cash = Column(Integer, nullable=False, default=0)
    max_upload_size_mb = Column(Integer, nullable=False, default=20)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)



