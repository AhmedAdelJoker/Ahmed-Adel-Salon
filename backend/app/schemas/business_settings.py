from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class BusinessSettingsBase(BaseModel):
    salon_name: str = Field(..., min_length=1, max_length=255)
    shop_phone: Optional[str] = Field(default=None, max_length=30)
    shop_whatsapp: Optional[str] = Field(default=None, max_length=30)
    address: Optional[str] = Field(default=None, max_length=500)
    receipt_footer: Optional[str] = None
    currency: str = Field(default="EGP", max_length=10)


class BusinessSettingsCreate(BusinessSettingsBase):
    pass


class BusinessSettingsUpdate(BaseModel):
    """
    Accepts both camelCase (from the React frontend) and snake_case.
    Example: landingHeroTitle  →  landing_hero_title on the model.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,   # also accept snake_case
    )

    salon_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    shop_phone: Optional[str] = Field(default=None, max_length=30)
    shop_whatsapp: Optional[str] = Field(default=None, max_length=30)
    address: Optional[str] = Field(default=None, max_length=500)
    receipt_footer: Optional[str] = None
    currency: Optional[str] = Field(default=None, max_length=10)
    working_hours: Optional[dict[str, Any]] = None

    # Landing page copy
    landing_hero_title: Optional[str] = None
    landing_hero_subtitle: Optional[str] = None
    landing_about_title: Optional[str] = None
    landing_about_content: Optional[str] = None
    landing_hero_badge: Optional[str] = None
    landing_services_eyebrow: Optional[str] = None
    landing_services_title: Optional[str] = None
    landing_services_subtitle: Optional[str] = None
    landing_portfolio_eyebrow: Optional[str] = None
    landing_portfolio_title: Optional[str] = None
    landing_booking_eyebrow: Optional[str] = None
    landing_booking_title: Optional[str] = None
    landing_booking_subtitle: Optional[str] = None
    landing_location_eyebrow: Optional[str] = None
    landing_location_title: Optional[str] = None
    landing_location_description: Optional[str] = None
    landing_location_open_label: Optional[str] = None
    landing_location_closed_label: Optional[str] = None
    landing_location_status_text: Optional[str] = None
    landing_contact_eyebrow: Optional[str] = None
    landing_contact_title: Optional[str] = None
    landing_contact_subtitle: Optional[str] = None
    landing_quick_actions_eyebrow: Optional[str] = None
    landing_quick_actions_title: Optional[str] = None
    landing_quick_actions_subtitle: Optional[str] = None
    landing_final_title: Optional[str] = None
    landing_final_subtitle: Optional[str] = None
    landing_final_button_label: Optional[str] = None
    landing_hero_highlight_title: Optional[str] = None
    landing_hero_highlight_subtitle: Optional[str] = None
    landing_hero_highlight_badge: Optional[str] = None
    landing_public_header_badge: Optional[str] = None
    landing_testimonials_eyebrow: Optional[str] = None
    landing_testimonials_title: Optional[str] = None
    landing_testimonials_subtitle: Optional[str] = None
    landing_cover_image_url: Optional[str] = None
    landing_theme_id: Optional[str] = None
    landing_show_staff: Optional[bool] = None
    landing_show_staff_bio: Optional[bool] = None

    # JSON arrays
    landing_stats: Optional[List[Any]] = None
    landing_features: Optional[List[Any]] = None
    landing_trust_badges: Optional[List[Any]] = None
    landing_testimonials: Optional[List[Any]] = None
    landing_portfolio: Optional[List[Any]] = None

    # Social links
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_tiktok: Optional[str] = None
    social_youtube: Optional[str] = None
    loyalty_settings: Optional[dict[str, Any]] = None
    monthly_revenue_target: Optional[float] = Field(default=None, ge=0)

    # Snapshot
    public_site_snapshot: Optional[dict[str, Any]] = None


class BusinessSettingsRead(BaseModel):
    """
    Returns camelCase keys to the React frontend.
    """

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: int
    salon_name: str
    shop_phone: Optional[str] = None
    shop_whatsapp: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    google_maps_url: Optional[str] = None
    receipt_footer: Optional[str] = None
    currency: str = "EGP"
    public_slug: Optional[str] = None
    working_hours: Optional[dict[str, Any]] = None

    # Landing page copy
    landing_hero_title: Optional[str] = None
    landing_hero_subtitle: Optional[str] = None
    landing_about_title: Optional[str] = None
    landing_about_content: Optional[str] = None
    landing_hero_badge: Optional[str] = None
    landing_services_eyebrow: Optional[str] = None
    landing_services_title: Optional[str] = None
    landing_services_subtitle: Optional[str] = None
    landing_portfolio_eyebrow: Optional[str] = None
    landing_portfolio_title: Optional[str] = None
    landing_booking_eyebrow: Optional[str] = None
    landing_booking_title: Optional[str] = None
    landing_booking_subtitle: Optional[str] = None
    landing_location_eyebrow: Optional[str] = None
    landing_location_title: Optional[str] = None
    landing_location_description: Optional[str] = None
    landing_location_open_label: Optional[str] = None
    landing_location_closed_label: Optional[str] = None
    landing_location_status_text: Optional[str] = None
    landing_contact_eyebrow: Optional[str] = None
    landing_contact_title: Optional[str] = None
    landing_contact_subtitle: Optional[str] = None
    landing_quick_actions_eyebrow: Optional[str] = None
    landing_quick_actions_title: Optional[str] = None
    landing_quick_actions_subtitle: Optional[str] = None
    landing_final_title: Optional[str] = None
    landing_final_subtitle: Optional[str] = None
    landing_final_button_label: Optional[str] = None
    landing_hero_highlight_title: Optional[str] = None
    landing_hero_highlight_subtitle: Optional[str] = None
    landing_hero_highlight_badge: Optional[str] = None
    landing_public_header_badge: Optional[str] = None
    landing_testimonials_eyebrow: Optional[str] = None
    landing_testimonials_title: Optional[str] = None
    landing_testimonials_subtitle: Optional[str] = None
    landing_cover_image_url: Optional[str] = None
    landing_theme_id: Optional[str] = None
    landing_show_staff: Optional[bool] = True
    landing_show_staff_bio: Optional[bool] = True

    # JSON arrays
    landing_stats: Optional[List[Any]] = None
    landing_features: Optional[List[Any]] = None
    landing_trust_badges: Optional[List[Any]] = None
    landing_testimonials: Optional[List[Any]] = None
    landing_portfolio: Optional[List[Any]] = None

    # Social links
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_tiktok: Optional[str] = None
    social_youtube: Optional[str] = None
    loyalty_settings: Optional[dict[str, Any]] = None
    monthly_revenue_target: float = 500000

    # Snapshot
    public_site_snapshot: Optional[dict[str, Any]] = None
    public_site_published_at: Optional[datetime] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
