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
from app.core.upload_security import validate_image, validate_video
from app.core.clock import utc_now_naive

router = APIRouter(prefix="/business-settings", tags=["Business Settings"])


# The fields `publish-site` copies into `public_site_snapshot`, and therefore
# the only fields the public site can ever see.
#
# Lifted to module scope because the staleness flag has to know this list to be
# honest. It used to compare `version` against `public_site_published_version`,
# which is correct only while every write that can change one of these fields
# also bumps `version`. A deployment where the two agree while the snapshot and
# the row disagree -- a field added to this list after a publish, a value
# written by anything other than the versioned PUT -- reports "published" and
# the owner's change never reaches the site. `landing_theme_id` is exactly that
# case in at least one database this branch has been run against: the row says
# `moss`, the snapshot says `gold`, and both version counters say 20.
PUBLIC_SNAPSHOT_FIELDS: tuple[str, ...] = (
    "salon_name", "shop_phone", "shop_whatsapp", "address", "logo_url",
    "public_slug", "working_hours",
    # Read by `booking_public` as `public_settings.get("currency")`, but never
    # snapshotted - so the public site always received `None` and fell back to
    # its own default no matter what the salon chose.
    "currency",
    "landing_hero_title", "landing_hero_subtitle", "landing_hero_badge",
    "landing_about_title", "landing_about_content",
    "landing_services_eyebrow", "landing_services_title", "landing_services_subtitle",
    "landing_portfolio_eyebrow", "landing_portfolio_title",
    "landing_booking_eyebrow", "landing_booking_title", "landing_booking_subtitle",
    "landing_location_eyebrow", "landing_location_title", "landing_location_description",
    # These three were on the model, in the pydantic schema, and rendered by the
    # public site - but missing from this list, so they never reached the
    # snapshot and the salon could not change a single word of them.
    "landing_location_open_label", "landing_location_closed_label",
    "landing_location_status_text",
    "landing_contact_eyebrow", "landing_contact_title", "landing_contact_subtitle",
    "landing_quick_actions_eyebrow", "landing_quick_actions_title", "landing_quick_actions_subtitle",
    "landing_final_title", "landing_final_subtitle", "landing_final_button_label",
    "landing_hero_highlight_title", "landing_hero_highlight_subtitle", "landing_hero_highlight_badge",
    "landing_public_header_badge",
    "landing_testimonials_eyebrow", "landing_testimonials_title", "landing_testimonials_subtitle",
    "landing_cover_image_url", "landing_theme_id",
    # Hero video + the motion master switch. Same trap as the fields above:
    # without these the owner could upload a clip, see it saved, and the public
    # site would never learn it existed.
    "landing_hero_video_url", "landing_video_poster_url",
    "landing_video_autoplay", "landing_video_muted", "landing_motion_enabled",
    "landing_show_staff", "landing_show_staff_bio",
    "landing_stats", "landing_features", "landing_trust_badges",
    "landing_testimonials", "landing_portfolio",
    "social_facebook", "social_instagram", "social_tiktok", "social_youtube",
)


def _snapshot_of(row: BusinessSettings) -> dict:
    """The snapshot the row would produce if it were published right now."""
    return {name: getattr(row, name, None) for name in PUBLIC_SNAPSHOT_FIELDS}


def _public_site_is_stale(row: BusinessSettings) -> bool:
    """Whether the live public site differs from what the owner has saved.

    Never-published is stale by definition. Beyond that, the version counters
    are only a fast path: if they match, the stored snapshot is still compared
    field by field, because that is the difference between "the owner pressed
    publish at the right moment" and "the public site actually shows what the
    settings row says".
    """
    published_version = getattr(row, "public_site_published_version", None)
    if published_version is None:
        return True
    stored = row.public_site_snapshot
    if not stored:
        return True
    if int(published_version) != int(getattr(row, "version", 1) or 1):
        return True
    return stored != _snapshot_of(row)




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
    payload = schema.model_dump(by_alias=True, mode="json")
    # Without this the publish button stays disabled on a fresh install and
    # nothing can ever make the site public, because the flag is the only thing
    # that enables the button.
    payload["publicSiteStale"] = _public_site_is_stale(row)
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


# A hero clip is decor, not an asset library: it is one file per salon, it is
# looped behind the headline, and it is competing with the LCP image for the
# visitor's bandwidth. 25 MB is comfortably above a 10-15s phone recording at
# 1080p and below the point where a visitor on mobile data abandons the page.
MAX_HERO_VIDEO_BYTES = 25 * 1024 * 1024


@router.post("/hero-video")
async def upload_hero_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """رفع فيديو قصير لخلفية الـ Hero.

    Unlike `/media`, the bytes are stored verbatim: there is no image pipeline to
    run, and re-encoding a clip server-side would strip the poster frame and cost
    more than the upload itself. Validation is extension + size (see
    `validate_video`), which is what the rest of the upload surface does.
    """
    content = await validate_video(file, max_size=MAX_HERO_VIDEO_BYTES)

    upload_dir = get_upload_path("business")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # The sanitizer inside validate_upload already reduced the name; keep the
    # suffix it validated against so the stored extension matches what the
    # public site will be asked to play.
    suffix = Path(file.filename or "").suffix.lower() or ".mp4"
    if suffix not in {".mp4", ".webm"}:
        suffix = ".mp4"
    filename = f"hero_{uuid.uuid4().hex}{suffix}"

    (upload_dir / filename).write_bytes(content)
    return {"url": f"/uploads/business/{filename}", "size": len(content)}


@router.post("/publish-site")
def publish_site(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """نشر تعديلات الموقع العام للجمهور."""
    from datetime import datetime

    row = _get_or_create_business_settings(db)
    row.public_site_published_at = utc_now_naive()

    # Snapshot: نسخ الإعدادات العامة الحالية لاستخدامها في الصفحة العامة
    row.public_site_snapshot = _snapshot_of(row)
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
