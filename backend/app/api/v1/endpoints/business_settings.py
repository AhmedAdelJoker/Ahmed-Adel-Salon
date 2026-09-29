import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager, require_any_staff, ensure_working_hours_editor
from app.core.config import settings
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.models.business_settings import BusinessSettings
from app.schemas.business_settings import BusinessSettingsRead, BusinessSettingsUpdate
from app.services.activity_log_service import log_activity
from app.utils.media import process_image_content, get_upload_path
from app.core.upload_security import validate_image

router = APIRouter(prefix="/business-settings", tags=["Business Settings"])

# uploads/business now resolved lazily via get_upload_path("business") (SOT §5.2)

def _get_or_create_business_settings(db: Session) -> BusinessSettings:
    row = db.query(BusinessSettings).first()

    if row:
        # تأكد أن currency دائمًا لها قيمة
        if not getattr(row, "currency", None):
            row.currency = "EGP"
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    row = BusinessSettings(
        salon_name="SalonPro",
        shop_phone=None,
        shop_whatsapp=None,
        address=None,
        receipt_footer=None,
        currency="EGP",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _row_to_response(row: BusinessSettings, etag: bool = False):
    """Serialize the ORM row using camelCase aliases for the React frontend."""
    schema = BusinessSettingsRead.model_validate(row)
    published_version = getattr(row, "public_site_published_version", None)
    payload = schema.model_dump(by_alias=True, mode="json")
    payload["publicSiteStale"] = bool(
        published_version is not None
        and int(published_version) != int(getattr(row, "version", 1) or 1)
    )
    out = JSONResponse(content=payload)
    if etag:
        # Returning a Response drops FastAPI's `response.headers` merge, so the
        # validator has to be stamped here instead.
        out.headers["ETag"] = f'W/"{getattr(row, "version", 1)}"'
    return out


def _changed_fields(before: dict, after: dict) -> list[str]:
    labels = {
        "working_hours": "ساعات العمل",
        "salon_name": "اسم المنشأة",
        "shop_phone": "رقم التواصل",
        "shop_whatsapp": "الواتساب",
        "address": "العنوان",
        "logo_url": "الشعار",
        "google_maps_url": "رابط الخريطة",
        "receipt_footer": "تذييل الإيصال",
        "currency": "العملة",
        "monthly_revenue_target": "هدف المبيعات الشهري",
        "loyalty_settings": "إعدادات الولاء",
    }
    return [labels.get(k, k) for k in after if before.get(k) != after.get(k)]


@router.get("")
def read_business_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    row = _get_or_create_business_settings(db)
    return _row_to_response(row)


@router.put(
    "",
    dependencies=[
        Depends(
            rate_limit(
                "business_settings_write",
                max_requests=settings.SETTINGS_WRITE_RATE_LIMIT_MAX_REQUESTS,
                window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
            )
        )
    ],
)
def update_business_settings(
    payload: BusinessSettingsUpdate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    if "working_hours" in payload.model_fields_set:
        ensure_working_hours_editor(current_user)

    row = _get_or_create_business_settings(db)

    incoming = payload.model_dump(exclude_none=True, exclude={"expected_version"})
    if not incoming:
        return _row_to_response(row)
    expected = payload.expected_version
    current_version = int(getattr(row, "version", 1) or 1)
    if expected is not None and int(expected) != current_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "تم تعديل الإعدادات من مستخدم آخر بعد أن فتحتها. "
                "حدّث الصفحة ثم أعد تطبيق تعديلاتك."
            ),
        )

    before = {field: getattr(row, field, None) for field in incoming}

    for field_name, value in incoming.items():
        if hasattr(row, field_name):
            setattr(row, field_name, value)

    row.version = current_version + 1

    db.add(row)
    db.commit()
    db.refresh(row)

    changed = _changed_fields(before, incoming)
    if changed:
        labels = {
            "UPDATE_BUSINESS_SETTINGS": "تعديل الإعدادات",
            "UPDATE_WORKING_HOURS": "تعديل ساعات العمل",
        }
        log_activity(
            db,
            user_id=current_user.id,
            action=(
                "UPDATE_WORKING_HOURS"
                if "working_hours" in incoming
                else "UPDATE_BUSINESS_SETTINGS"
            ),
            entity_type="BusinessSettings",
            entity_id=str(row.id),
            description=(
                f"{labels['UPDATE_WORKING_HOURS'] if 'working_hours' in incoming else labels['UPDATE_BUSINESS_SETTINGS']}"
                f": {', '.join(changed)} (الإصدار {row.version})"
            ),
        )

    return _row_to_response(row, etag=True)


@router.post("/logo", response_model=BusinessSettingsRead)
async def upload_business_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """رفع لوجو المحل وتحديث الإعدادات."""
    row = _get_or_create_business_settings(db)
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image(file, max_size=5 * 1024 * 1024)
    upload_dir = get_upload_path("business")
    filename = process_image_content(content, file.filename, upload_dir)
    row.logo_url = f"/uploads/business/{filename}"
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_response(row)


@router.post("/media")
async def upload_business_media(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """رفع صورة للصفحة العامة (غلاف أو معرض)."""
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image(file, max_size=10 * 1024 * 1024)
    upload_dir = get_upload_path("business")
    filename = process_image_content(content, file.filename, upload_dir)
    # رابط نسبي — الفرونت-إند يضيف STATIC_URL أمامه
    url = f"/uploads/business/{filename}"
    return {"url": url}


@router.post("/publish-site")
def publish_site(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """نشر تعديلات الموقع العام للجمهور."""
    from datetime import datetime

    row = _get_or_create_business_settings(db)
    row.public_site_published_at = datetime.utcnow()

    # Snapshot: نسخ الإعدادات العامة الحالية لاستخدامها في الصفحة العامة
    snapshot_fields = [
        "salon_name", "shop_phone", "shop_whatsapp", "address", "logo_url",
        "public_slug", "working_hours",
        "landing_hero_title", "landing_hero_subtitle", "landing_hero_badge",
        "landing_about_title", "landing_about_content",
        "landing_services_eyebrow", "landing_services_title", "landing_services_subtitle",
        "landing_portfolio_eyebrow", "landing_portfolio_title",
        "landing_booking_eyebrow", "landing_booking_title", "landing_booking_subtitle",
        "landing_location_eyebrow", "landing_location_title", "landing_location_description",
        "landing_contact_eyebrow", "landing_contact_title", "landing_contact_subtitle",
        "landing_quick_actions_eyebrow", "landing_quick_actions_title", "landing_quick_actions_subtitle",
        "landing_final_title", "landing_final_subtitle", "landing_final_button_label",
        "landing_hero_highlight_title", "landing_hero_highlight_subtitle", "landing_hero_highlight_badge",
        "landing_public_header_badge",
        "landing_testimonials_eyebrow", "landing_testimonials_title", "landing_testimonials_subtitle",
        "landing_cover_image_url", "landing_theme_id",
        "landing_show_staff", "landing_show_staff_bio",
        "landing_stats", "landing_features", "landing_trust_badges",
        "landing_testimonials", "landing_portfolio",
        "social_facebook", "social_instagram", "social_tiktok", "social_youtube",
    ]
    snapshot = {name: getattr(row, name, None) for name in snapshot_fields}
    row.public_site_snapshot = snapshot
    row.public_site_published_version = int(getattr(row, "version", 1) or 1)

    log_activity(
        db,
        user_id=current_user.id,
        action="PUBLISH_PUBLIC_SITE",
        entity_type="BusinessSettings",
        entity_id=str(row.id),
        description=f"نشر الموقع العام (الإصدار {row.public_site_published_version})",
    )

    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_response(row)
