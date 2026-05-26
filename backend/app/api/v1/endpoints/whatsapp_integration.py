from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.core.config import settings
from app.db.session import get_db
from app.models.business_settings import BusinessSettings
from app.models.user import User
from app.schemas.whatsapp_integration import (
    WhatsAppIntegrationStatusRead,
    WhatsAppTestRequest,
    WhatsAppTestResponse,
    WhatsAppWebhookReceiveRead,
)
from app.services.meta_whatsapp_service import (
    get_meta_whatsapp_status,
    is_meta_whatsapp_configured,
    normalize_to_phone,
    send_text_message,
    update_logs_from_webhook_payload,
)
from app.services.automation_service import run_automated_reminders

router = APIRouter(prefix="/integrations/whatsapp", tags=["WhatsApp Integration"])


@router.post("/run-reminders")
def trigger_automated_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """
    Trigger the background scan for upcoming appointment reminders.
    """
    stats = run_automated_reminders(db)
    return {"message": "Automated reminders scan completed", "stats": stats}


@router.get("/status", response_model=WhatsAppIntegrationStatusRead)
def read_whatsapp_status(
    current_user: User = Depends(require_owner),
):
    _ = current_user
    return WhatsAppIntegrationStatusRead(**get_meta_whatsapp_status())


@router.post("/test", response_model=WhatsAppTestResponse)
def send_whatsapp_test_message(
    payload: WhatsAppTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    if not is_meta_whatsapp_configured():
        raise HTTPException(
            status_code=503,
            detail="Meta WhatsApp Cloud API is not configured in environment variables",
        )

    settings_row = db.query(BusinessSettings).first()
    target_phone = payload.phone or (settings_row.shop_whatsapp if settings_row else None)
    if not target_phone:
        raise HTTPException(
            status_code=400,
            detail="Provide a target phone or set the shop WhatsApp number first",
        )

    body = (
        payload.message
        or "رسالة اختبار من نظام إدارة محل الحلاقة. إذا وصلتك الرسالة فتكامل واتساب يعمل بنجاح."
    )

    try:
        response = send_text_message(
            db,
            to_phone=target_phone,
            body=body,
            message_type="owner_whatsapp_test",
            created_by_user_id=getattr(current_user, "id", None),
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        try:
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    messages = response.get("messages", []) if isinstance(response, dict) else []
    return WhatsAppTestResponse(
        message="WhatsApp test message sent successfully",
        normalized_phone=normalize_to_phone(target_phone),
        provider_message_id=messages[0].get("id") if messages else None,
    )


@router.get("/webhook", response_class=PlainTextResponse)
def verify_meta_whatsapp_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
):
    if not settings.META_WA_VERIFY_TOKEN:
        raise HTTPException(status_code=503, detail="Verify token is not configured")

    if hub_mode == "subscribe" and hub_verify_token == settings.META_WA_VERIFY_TOKEN:
        return hub_challenge

    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/webhook", response_model=WhatsAppWebhookReceiveRead)
async def receive_meta_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.json()
    updated_logs_count = update_logs_from_webhook_payload(db, payload)
    return WhatsAppWebhookReceiveRead(received=True, updated_logs_count=updated_logs_count)



