from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Boolean, JSON
from sqlalchemy.sql import func

from app.db.base_class import Base


class BusinessSettings(Base):
    __tablename__ = "business_settings"

    id = Column(Integer, primary_key=True, index=True)
    salon_name = Column(String(255), nullable=False, default="SalonPro")
    shop_phone = Column(String(30), nullable=True)
    shop_whatsapp = Column(String(30), nullable=True)
    address = Column(String(500), nullable=True)
    logo_url = Column(String(500), nullable=True)
    google_maps_url = Column(String(1000), nullable=True)
    receipt_footer = Column(Text, nullable=True)
    currency = Column(String(10), nullable=False, default="EGP")
    public_slug = Column(String(255), nullable=True)
    manager_approval_pin = Column(String(20), nullable=True, default="1234")

    cashier_discount_limit_type = Column(String(20), nullable=False, default="percent")
    cashier_discount_limit_value = Column(Numeric(10, 2), nullable=False, default=10)
    manager_discount_limit_type = Column(String(20), nullable=False, default="percent")
    manager_discount_limit_value = Column(Numeric(10, 2), nullable=False, default=50)

    allow_cash = Column(Boolean, nullable=False, default=True)
    allow_vodafone_cash = Column(Boolean, nullable=False, default=True)
    allow_instapay = Column(Boolean, nullable=False, default=True)
    allow_bank_card = Column(Boolean, nullable=False, default=True)
    working_hours = Column(JSON, nullable=True)
    shift_auto_close_grace_period = Column(Integer, nullable=False, default=30)  # Minutes after closing time before auto-close
    landing_hero_title = Column(String(500), nullable=True)
    landing_hero_subtitle = Column(Text, nullable=True)
    landing_about_title = Column(String(500), nullable=True)
    landing_about_content = Column(Text, nullable=True)
    landing_hero_badge = Column(String(255), nullable=True)
    landing_services_eyebrow = Column(String(255), nullable=True)
    landing_services_title = Column(String(500), nullable=True)
    landing_services_subtitle = Column(Text, nullable=True)
    landing_portfolio_eyebrow = Column(String(255), nullable=True)
    landing_portfolio_title = Column(String(500), nullable=True)
    landing_booking_eyebrow = Column(String(255), nullable=True)
    landing_booking_title = Column(String(500), nullable=True)
    landing_booking_subtitle = Column(Text, nullable=True)
    landing_location_eyebrow = Column(String(255), nullable=True)
    landing_location_title = Column(String(500), nullable=True)
    landing_location_description = Column(Text, nullable=True)
    landing_location_open_label = Column(String(255), nullable=True)
    landing_location_closed_label = Column(String(255), nullable=True)
    landing_location_status_text = Column(String(500), nullable=True)
    landing_contact_eyebrow = Column(String(255), nullable=True)
    landing_contact_title = Column(String(500), nullable=True)
    landing_contact_subtitle = Column(Text, nullable=True)
    landing_quick_actions_eyebrow = Column(String(255), nullable=True)
    landing_quick_actions_title = Column(String(500), nullable=True)
    landing_quick_actions_subtitle = Column(Text, nullable=True)
    landing_final_title = Column(String(500), nullable=True)
    landing_final_subtitle = Column(Text, nullable=True)
    landing_final_button_label = Column(String(255), nullable=True)
    landing_hero_highlight_title = Column(String(255), nullable=True)
    landing_hero_highlight_subtitle = Column(String(500), nullable=True)
    landing_hero_highlight_badge = Column(String(255), nullable=True)
    landing_public_header_badge = Column(String(255), nullable=True)
    landing_testimonials_eyebrow = Column(String(255), nullable=True)
    landing_testimonials_title = Column(String(500), nullable=True)
    landing_testimonials_subtitle = Column(Text, nullable=True)
    landing_cover_image_url = Column(String(500), nullable=True)
    landing_theme_id = Column(String(50), nullable=True, default="gold")
    landing_show_staff = Column(Boolean, nullable=True, default=True)
    landing_show_staff_bio = Column(Boolean, nullable=True, default=True)
    landing_stats = Column(JSON, nullable=True)
    landing_features = Column(JSON, nullable=True)
    landing_trust_badges = Column(JSON, nullable=True)
    landing_testimonials = Column(JSON, nullable=True)
    landing_portfolio = Column(JSON, nullable=True)
    social_facebook = Column(String(500), nullable=True)
    social_instagram = Column(String(500), nullable=True)
    social_tiktok = Column(String(500), nullable=True)
    social_youtube = Column(String(500), nullable=True)
    
    # Loyalty System Configuration
    loyalty_settings = Column(JSON, nullable=True) # {enabled: bool, tiers: [], points_per_egp: float, etc}
    
    public_site_snapshot = Column(JSON, nullable=True)
    public_site_published_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        onupdate=func.now(),
    )