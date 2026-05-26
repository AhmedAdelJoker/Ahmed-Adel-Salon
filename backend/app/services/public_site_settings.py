from __future__ import annotations
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

from typing import Any

from app.models.business_settings import BusinessSettings


PUBLIC_SITE_DEFAULTS = {
    "salon_name": "SalonPro",
    "salonName": "SalonPro",
    "currency": "EGP",
    "working_hours": None,
    "workingHours": None,
}


def _serialize_public_business_row(settings_row: BusinessSettings) -> dict[str, Any]:
    return {
        "salon_name": settings_row.salon_name,
        "salonName": settings_row.salon_name,
        "shop_phone": settings_row.shop_phone,
        "shopPhone": settings_row.shop_phone,
        "shop_whatsapp": settings_row.shop_whatsapp,
        "shopWhatsApp": settings_row.shop_whatsapp,
        "address": settings_row.address,
        "logo_url": settings_row.logo_url,
        "logoUrl": settings_row.logo_url,
        "google_maps_url": settings_row.google_maps_url,
        "googleMapsUrl": settings_row.google_maps_url,
        "receipt_footer": settings_row.receipt_footer,
        "receiptFooter": settings_row.receipt_footer,
        "currency": settings_row.currency,
        "public_slug": settings_row.public_slug,
        "publicSlug": settings_row.public_slug,
        "working_hours": settings_row.working_hours,
        "workingHours": settings_row.working_hours,
        "landing_hero_title": settings_row.landing_hero_title,
        "landingHeroTitle": settings_row.landing_hero_title,
        "landing_hero_subtitle": settings_row.landing_hero_subtitle,
        "landingHeroSubtitle": settings_row.landing_hero_subtitle,
        "landing_about_title": settings_row.landing_about_title,
        "landingAboutTitle": settings_row.landing_about_title,
        "landing_about_content": settings_row.landing_about_content,
        "landingAboutContent": settings_row.landing_about_content,
        "landing_hero_badge": settings_row.landing_hero_badge,
        "landingHeroBadge": settings_row.landing_hero_badge,
        "landing_services_eyebrow": settings_row.landing_services_eyebrow,
        "landingServicesEyebrow": settings_row.landing_services_eyebrow,
        "landing_services_title": settings_row.landing_services_title,
        "landingServicesTitle": settings_row.landing_services_title,
        "landing_services_subtitle": settings_row.landing_services_subtitle,
        "landingServicesSubtitle": settings_row.landing_services_subtitle,
        "landing_portfolio_eyebrow": settings_row.landing_portfolio_eyebrow,
        "landingPortfolioEyebrow": settings_row.landing_portfolio_eyebrow,
        "landing_portfolio_title": settings_row.landing_portfolio_title,
        "landingPortfolioTitle": settings_row.landing_portfolio_title,
        "landing_booking_eyebrow": settings_row.landing_booking_eyebrow,
        "landingBookingEyebrow": settings_row.landing_booking_eyebrow,
        "landing_booking_title": settings_row.landing_booking_title,
        "landingBookingTitle": settings_row.landing_booking_title,
        "landing_booking_subtitle": settings_row.landing_booking_subtitle,
        "landingBookingSubtitle": settings_row.landing_booking_subtitle,
        "landing_location_eyebrow": settings_row.landing_location_eyebrow,
        "landingLocationEyebrow": settings_row.landing_location_eyebrow,
        "landing_location_title": settings_row.landing_location_title,
        "landingLocationTitle": settings_row.landing_location_title,
        "landing_location_description": settings_row.landing_location_description,
        "landingLocationDescription": settings_row.landing_location_description,
        "landing_location_open_label": settings_row.landing_location_open_label,
        "landingLocationOpenLabel": settings_row.landing_location_open_label,
        "landing_location_closed_label": settings_row.landing_location_closed_label,
        "landingLocationClosedLabel": settings_row.landing_location_closed_label,
        "landing_location_status_text": settings_row.landing_location_status_text,
        "landingLocationStatusText": settings_row.landing_location_status_text,
        "landing_contact_eyebrow": settings_row.landing_contact_eyebrow,
        "landingContactEyebrow": settings_row.landing_contact_eyebrow,
        "landing_contact_title": settings_row.landing_contact_title,
        "landingContactTitle": settings_row.landing_contact_title,
        "landing_contact_subtitle": settings_row.landing_contact_subtitle,
        "landingContactSubtitle": settings_row.landing_contact_subtitle,
        "landing_quick_actions_eyebrow": settings_row.landing_quick_actions_eyebrow,
        "landingQuickActionsEyebrow": settings_row.landing_quick_actions_eyebrow,
        "landing_quick_actions_title": settings_row.landing_quick_actions_title,
        "landingQuickActionsTitle": settings_row.landing_quick_actions_title,
        "landing_quick_actions_subtitle": settings_row.landing_quick_actions_subtitle,
        "landingQuickActionsSubtitle": settings_row.landing_quick_actions_subtitle,
        "landing_final_title": settings_row.landing_final_title,
        "landingFinalTitle": settings_row.landing_final_title,
        "landing_final_subtitle": settings_row.landing_final_subtitle,
        "landingFinalSubtitle": settings_row.landing_final_subtitle,
        "landing_final_button_label": settings_row.landing_final_button_label,
        "landingFinalButtonLabel": settings_row.landing_final_button_label,
        "landing_hero_highlight_title": settings_row.landing_hero_highlight_title,
        "landingHeroHighlightTitle": settings_row.landing_hero_highlight_title,
        "landing_hero_highlight_subtitle": settings_row.landing_hero_highlight_subtitle,
        "landingHeroHighlightSubtitle": settings_row.landing_hero_highlight_subtitle,
        "landing_hero_highlight_badge": settings_row.landing_hero_highlight_badge,
        "landingHeroHighlightBadge": settings_row.landing_hero_highlight_badge,
        "landing_public_header_badge": settings_row.landing_public_header_badge,
        "landingPublicHeaderBadge": settings_row.landing_public_header_badge,
        "landing_cover_image_url": settings_row.landing_cover_image_url,
        "landingCoverImageUrl": settings_row.landing_cover_image_url,
        "landing_testimonials_eyebrow": settings_row.landing_testimonials_eyebrow,
        "landingTestimonialsEyebrow": settings_row.landing_testimonials_eyebrow,
        "landing_testimonials_title": settings_row.landing_testimonials_title,
        "landingTestimonialsTitle": settings_row.landing_testimonials_title,
        "landing_testimonials_subtitle": settings_row.landing_testimonials_subtitle,
        "landingTestimonialsSubtitle": settings_row.landing_testimonials_subtitle,
        "landing_stats": settings_row.landing_stats,
        "landingStats": settings_row.landing_stats,
        "landing_features": settings_row.landing_features,
        "landingFeatures": settings_row.landing_features,
        "landing_trust_badges": settings_row.landing_trust_badges,
        "landingTrustBadges": settings_row.landing_trust_badges,
        "landing_testimonials": settings_row.landing_testimonials,
        "landingTestimonials": settings_row.landing_testimonials,
        "landing_portfolio": settings_row.landing_portfolio,
        "landingPortfolio": settings_row.landing_portfolio,
        "social_facebook": settings_row.social_facebook,
        "socialFacebook": settings_row.social_facebook,
        "social_instagram": settings_row.social_instagram,
        "socialInstagram": settings_row.social_instagram,
        "social_tiktok": settings_row.social_tiktok,
        "socialTiktok": settings_row.social_tiktok,
        "social_youtube": settings_row.social_youtube,
        "socialYoutube": settings_row.social_youtube,
    }


def serialize_public_business(
    settings_row: BusinessSettings | None,
    *,
    prefer_published: bool = True,
) -> dict[str, Any]:
    if not settings_row:
        return dict(PUBLIC_SITE_DEFAULTS)

    current_payload = {
        **PUBLIC_SITE_DEFAULTS,
        **_serialize_public_business_row(settings_row),
    }
    published_snapshot = getattr(settings_row, "public_site_snapshot", None)

    if prefer_published and isinstance(published_snapshot, dict) and published_snapshot:
        return {
            **PUBLIC_SITE_DEFAULTS,
            **published_snapshot,
        }

    return current_payload


def build_public_site_snapshot(settings_row: BusinessSettings) -> dict[str, Any]:
    return serialize_public_business(settings_row, prefer_published=False)


def has_public_site_draft_changes(settings_row: BusinessSettings | None) -> bool:
    if not settings_row:
        return False

    published_snapshot = getattr(settings_row, "public_site_snapshot", None)
    if not isinstance(published_snapshot, dict) or not published_snapshot:
        return False

    current_payload = build_public_site_snapshot(settings_row)
    return published_snapshot != current_payload



