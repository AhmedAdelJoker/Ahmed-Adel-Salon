from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from pathlib import Path
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner, require_any_staff
from app.models.user import User
from app.models.business_settings import BusinessSettings
from app.schemas.business_settings import BusinessSettingsRead, BusinessSettingsUpdate
from app.services.public_site_settings import (
    build_public_site_snapshot,
    has_public_site_draft_changes,
)

router = APIRouter(prefix="/business-settings", tags=["Business Settings"])



MAX_LOGO_SIZE_BYTES = 20 * 1024 * 1024
ALLOWED_LOGO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
UPLOADS_DIR = Path(__file__).resolve().parents[4] / "uploads" / "business"
LOGO_URL_PREFIX = "/uploads/business"

DEFAULT_WORKING_HOURS = {
    "saturday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
    "sunday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
    "monday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
    "tuesday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
    "wednesday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
    "thursday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
    "friday": {"is_open": False, "open_time": None, "close_time": None}
}


def _attach_public_site_meta(row: BusinessSettings) -> BusinessSettings:
    row.public_site_has_draft_changes = has_public_site_draft_changes(row)
    return row


async def _store_uploaded_business_image(file: UploadFile, *, prefix: str) -> str:
    original_name = file.filename or prefix
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_LOGO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="صيغة الصورة غير مدعومة. الصيغ المسموحة: JPG, JPEG, PNG, WEBP",
        )

    content = await file.read()
    if len(content) > MAX_LOGO_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="حجم الصورة أكبر من الحد المسموح 20 ميجابايت",
        )
    if not content:
        raise HTTPException(status_code=400, detail="ملف الصورة فارغ")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{prefix}_{uuid.uuid4().hex}{ext}"
    destination = UPLOADS_DIR / filename
    destination.write_bytes(content)
    return f"{LOGO_URL_PREFIX}/{filename}"


def _get_or_create_business_settings(db: Session) -> BusinessSettings:
    row = db.query(BusinessSettings).first()

    if row:
        # تأكد أن currency دائمًا لها قيمة
        if not getattr(row, "currency", None):
            row.currency = "EGP"
        if not row.working_hours:
            row.working_hours = DEFAULT_WORKING_HOURS
        
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    row = BusinessSettings(
        salon_name="SalonPro",
        shop_phone=None,
        shop_whatsapp=None,
        address=None,
 logo_url=None,
        receipt_footer=None,
        currency="EGP",
        cashier_discount_limit_type="amount",
        cashier_discount_limit_value=0,
        manager_discount_limit_type="amount",
        manager_discount_limit_value=1000,
        allow_cash=True,
        allow_vodafone_cash=True,
        allow_instapay=True,
        allow_bank_card=True,
        working_hours=DEFAULT_WORKING_HOURS
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=BusinessSettingsRead)
def read_business_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    return _attach_public_site_meta(_get_or_create_business_settings(db))


@router.put("", response_model=BusinessSettingsRead)
def update_business_settings(
    payload: BusinessSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    row = _get_or_create_business_settings(db)

    if payload.salonName is not None:
        row.salon_name = payload.salonName
    if payload.shopPhone is not None:
        row.shop_phone = payload.shopPhone
    if payload.shopWhatsApp is not None:
        row.shop_whatsapp = payload.shopWhatsApp
    if payload.address is not None:
        row.address = payload.address
    if payload.logoUrl is not None:
        row.logo_url = payload.logoUrl
    if payload.googleMapsUrl is not None:
        row.google_maps_url = payload.googleMapsUrl
    if payload.receiptFooter is not None:
        row.receipt_footer = payload.receiptFooter
    if payload.currency is not None:
        row.currency = payload.currency
    if payload.publicSlug is not None:
        row.public_slug = payload.publicSlug
    if payload.cashierDiscountLimitType is not None:
        row.cashier_discount_limit_type = payload.cashierDiscountLimitType
    if payload.cashierDiscountLimitValue is not None:
        row.cashier_discount_limit_value = payload.cashierDiscountLimitValue
    if payload.managerDiscountLimitType is not None:
        row.manager_discount_limit_type = payload.managerDiscountLimitType
    if payload.managerDiscountLimitValue is not None:
        row.manager_discount_limit_value = payload.managerDiscountLimitValue
    if payload.allowCash is not None:
        row.allow_cash = payload.allowCash
    if payload.allowVodafoneCash is not None:
        row.allow_vodafone_cash = payload.allowVodafoneCash
    if payload.allowInstapay is not None:
        row.allow_instapay = payload.allowInstapay
    if payload.allowBankCard is not None:
        row.allow_bank_card = payload.allowBankCard
    if payload.workingHours is not None:
        row.working_hours = payload.workingHours
    if payload.landingHeroTitle is not None:
        row.landing_hero_title = payload.landingHeroTitle
    if payload.landingHeroSubtitle is not None:
        row.landing_hero_subtitle = payload.landingHeroSubtitle
    if payload.landingAboutTitle is not None:
        row.landing_about_title = payload.landingAboutTitle
    if payload.landingAboutContent is not None:
        row.landing_about_content = payload.landingAboutContent
    if payload.landingHeroBadge is not None:
        row.landing_hero_badge = payload.landingHeroBadge
    if payload.landingServicesEyebrow is not None:
        row.landing_services_eyebrow = payload.landingServicesEyebrow
    if payload.landingServicesTitle is not None:
        row.landing_services_title = payload.landingServicesTitle
    if payload.landingServicesSubtitle is not None:
        row.landing_services_subtitle = payload.landingServicesSubtitle
    if payload.landingPortfolioEyebrow is not None:
        row.landing_portfolio_eyebrow = payload.landingPortfolioEyebrow
    if payload.landingPortfolioTitle is not None:
        row.landing_portfolio_title = payload.landingPortfolioTitle
    if payload.landingBookingEyebrow is not None:
        row.landing_booking_eyebrow = payload.landingBookingEyebrow
    if payload.landingBookingTitle is not None:
        row.landing_booking_title = payload.landingBookingTitle
    if payload.landingBookingSubtitle is not None:
        row.landing_booking_subtitle = payload.landingBookingSubtitle
    if payload.landingLocationEyebrow is not None:
        row.landing_location_eyebrow = payload.landingLocationEyebrow
    if payload.landingLocationTitle is not None:
        row.landing_location_title = payload.landingLocationTitle
    if payload.landingLocationDescription is not None:
        row.landing_location_description = payload.landingLocationDescription
    if payload.landingLocationOpenLabel is not None:
        row.landing_location_open_label = payload.landingLocationOpenLabel
    if payload.landingLocationClosedLabel is not None:
        row.landing_location_closed_label = payload.landingLocationClosedLabel
    if payload.landingLocationStatusText is not None:
        row.landing_location_status_text = payload.landingLocationStatusText
    if payload.landingContactEyebrow is not None:
        row.landing_contact_eyebrow = payload.landingContactEyebrow
    if payload.landingContactTitle is not None:
        row.landing_contact_title = payload.landingContactTitle
    if payload.landingContactSubtitle is not None:
        row.landing_contact_subtitle = payload.landingContactSubtitle
    if payload.landingQuickActionsEyebrow is not None:
        row.landing_quick_actions_eyebrow = payload.landingQuickActionsEyebrow
    if payload.landingQuickActionsTitle is not None:
        row.landing_quick_actions_title = payload.landingQuickActionsTitle
    if payload.landingQuickActionsSubtitle is not None:
        row.landing_quick_actions_subtitle = payload.landingQuickActionsSubtitle
    if payload.landingFinalTitle is not None:
        row.landing_final_title = payload.landingFinalTitle
    if payload.landingFinalSubtitle is not None:
        row.landing_final_subtitle = payload.landingFinalSubtitle
    if payload.landingFinalButtonLabel is not None:
        row.landing_final_button_label = payload.landingFinalButtonLabel
    if payload.landingHeroHighlightTitle is not None:
        row.landing_hero_highlight_title = payload.landingHeroHighlightTitle
    if payload.landingHeroHighlightSubtitle is not None:
        row.landing_hero_highlight_subtitle = payload.landingHeroHighlightSubtitle
    if payload.landingHeroHighlightBadge is not None:
        row.landing_hero_highlight_badge = payload.landingHeroHighlightBadge
    if payload.landingPublicHeaderBadge is not None:
        row.landing_public_header_badge = payload.landingPublicHeaderBadge
    if payload.landingCoverImageUrl is not None:
        row.landing_cover_image_url = payload.landingCoverImageUrl
    if payload.landingThemeId is not None:
        row.landing_theme_id = payload.landingThemeId
    if payload.landingShowStaff is not None:
        row.landing_show_staff = payload.landingShowStaff
    if payload.landingShowStaffBio is not None:
        row.landing_show_staff_bio = payload.landingShowStaffBio
    if payload.landingTestimonialsEyebrow is not None:
        row.landing_testimonials_eyebrow = payload.landingTestimonialsEyebrow
    if payload.landingTestimonialsTitle is not None:
        row.landing_testimonials_title = payload.landingTestimonialsTitle
    if payload.landingTestimonialsSubtitle is not None:
        row.landing_testimonials_subtitle = payload.landingTestimonialsSubtitle
    if payload.landingStats is not None:
        row.landing_stats = payload.landingStats
    if payload.landingFeatures is not None:
        row.landing_features = payload.landingFeatures
    if payload.landingTrustBadges is not None:
        row.landing_trust_badges = payload.landingTrustBadges
    if payload.landingTestimonials is not None:
        row.landing_testimonials = payload.landingTestimonials
    if payload.landingPortfolio is not None:
        row.landing_portfolio = payload.landingPortfolio
    if payload.socialFacebook is not None:
        row.social_facebook = payload.socialFacebook
    if payload.socialInstagram is not None:
        row.social_instagram = payload.socialInstagram
    if payload.socialTiktok is not None:
        row.social_tiktok = payload.socialTiktok
    if payload.socialYoutube is not None:
        row.social_youtube = payload.socialYoutube

    db.add(row)
    db.commit()
    db.refresh(row)
    return _attach_public_site_meta(row)


@router.post("/publish-site", response_model=BusinessSettingsRead)
def publish_business_site(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    row = _get_or_create_business_settings(db)
    row.public_site_snapshot = build_public_site_snapshot(row)
    row.public_site_published_at = datetime.now(timezone.utc)

    db.add(row)
    db.commit()
    db.refresh(row)
    return _attach_public_site_meta(row)


@router.post("/logo", response_model=BusinessSettingsRead)
async def upload_business_logo(
 file: UploadFile = File(...),
 db: Session = Depends(get_db),
 current_user: User = Depends(require_owner),
):
 row = _get_or_create_business_settings(db)
 row.logo_url = await _store_uploaded_business_image(file, prefix="logo")
 db.add(row)
 db.commit()
 db.refresh(row)
 return _attach_public_site_meta(row)


@router.post("/media")
async def upload_business_media(
 file: UploadFile = File(...),
 db: Session = Depends(get_db),
 current_user: User = Depends(require_owner),
):
 _get_or_create_business_settings(db)
 url = await _store_uploaded_business_image(file, prefix="media")
 return {"url": url}



