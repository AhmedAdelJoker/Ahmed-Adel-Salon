from __future__ import annotations

from pathlib import Path
from typing import Any

import requests
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.config import settings
from app.models.notification_log import NotificationLog


def _graph_base() -> str:
    return f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}"


def _messages_url() -> str:
    return f"{_graph_base()}/{settings.META_WA_PHONE_NUMBER_ID}/messages"


def _media_url() -> str:
    return f"{_graph_base()}/{settings.META_WA_PHONE_NUMBER_ID}/media"


def _headers_json() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.META_WA_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }


def _headers_auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.META_WA_ACCESS_TOKEN}"}


def _normalize_to_phone(to_phone: str) -> str:
    return str(to_phone).replace(" ", "").strip()


def normalize_to_phone(to_phone: str) -> str:
    return _normalize_to_phone(to_phone)


def is_meta_whatsapp_configured() -> bool:
    return bool(settings.META_WA_PHONE_NUMBER_ID and settings.META_WA_ACCESS_TOKEN)


def get_meta_whatsapp_status() -> dict[str, Any]:
    return {
        "configured": is_meta_whatsapp_configured(),
        "provider_name": "meta_cloud_api",
        "graph_api_version": settings.META_GRAPH_API_VERSION,
        "phone_number_id_present": bool(settings.META_WA_PHONE_NUMBER_ID),
        "access_token_present": bool(settings.META_WA_ACCESS_TOKEN),
        "verify_token_present": bool(settings.META_WA_VERIFY_TOKEN),
    }


def _create_notification_log(db: Session, *, appointment_id: int | None, invoice_id: int | None, created_by_user_id: int | None, message_type: str, recipient_phone: str, payload: str):
    log = NotificationLog(
        appointment_id=appointment_id,
        invoice_id=invoice_id,
        created_by_user_id=created_by_user_id,
        channel="whatsapp",
        message_type=message_type,
        recipient_phone=recipient_phone,
        provider_name="meta_cloud_api",
        payload=payload,
        status="queued",
    )
    db.add(log)
    db.flush()
    return log


def upload_media(file_path: str, mime_type: str = "application/pdf") -> str:
    if not settings.META_WA_PHONE_NUMBER_ID or not settings.META_WA_ACCESS_TOKEN:
        raise RuntimeError("Meta Cloud API credentials are not configured")
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    with open(path, "rb") as f:
        files = {"file": (path.name, f, mime_type)}
        data = {"messaging_product": "whatsapp", "type": mime_type}
        response = requests.post(_media_url(), headers=_headers_auth(), data=data, files=files, timeout=60)
    if response.status_code >= 400:
        raise RuntimeError(f"Meta media upload failed: {response.status_code} - {response.text}")
    media_id = response.json().get("id")
    if not media_id:
        raise RuntimeError(f"Meta media upload did not return id: {response.text}")
    return media_id


def send_text_message(db: Session, *, to_phone: str, body: str, message_type: str, appointment_id: int | None = None, invoice_id: int | None = None, created_by_user_id: int | None = None) -> dict[str, Any]:
    to_phone = _normalize_to_phone(to_phone)
    log = _create_notification_log(db, appointment_id=appointment_id, invoice_id=invoice_id, created_by_user_id=created_by_user_id, message_type=message_type, recipient_phone=to_phone, payload=body)
    payload = {"messaging_product": "whatsapp", "to": to_phone, "type": "text", "text": {"preview_url": False, "body": body}}
    response = requests.post(_messages_url(), headers=_headers_json(), json=payload, timeout=60)
    if response.status_code >= 400:
        log.status = "failed"
        log.failure_reason = response.text
        raise RuntimeError(f"Meta text message failed: {response.status_code} - {response.text}")
    res = response.json()
    log.status = "sent"
    log.provider_message_id = (res.get("messages", [{}])[0].get("id") if isinstance(res.get("messages"), list) else None)
    return res


def send_document_message_by_media_id(db: Session, *, to_phone: str, media_id: str, filename: str, caption: str | None = None, message_type: str = "document", appointment_id: int | None = None, invoice_id: int | None = None, created_by_user_id: int | None = None) -> dict[str, Any]:
    to_phone = _normalize_to_phone(to_phone)
    payload_log = f"media_id={media_id}, filename={filename}, caption={caption or ''}"
    log = _create_notification_log(db, appointment_id=appointment_id, invoice_id=invoice_id, created_by_user_id=created_by_user_id, message_type=message_type, recipient_phone=to_phone, payload=payload_log)
    payload = {"messaging_product": "whatsapp", "to": to_phone, "type": "document", "document": {"id": media_id, "filename": filename}}
    if caption:
        payload["document"]["caption"] = caption
    response = requests.post(_messages_url(), headers=_headers_json(), json=payload, timeout=60)
    if response.status_code >= 400:
        log.status = "failed"
        log.failure_reason = response.text
        raise RuntimeError(f"Meta document message failed: {response.status_code} - {response.text}")
    res = response.json()
    log.status = "sent"
    log.provider_message_id = (res.get("messages", [{}])[0].get("id") if isinstance(res.get("messages"), list) else None)
    return res


def upload_and_send_pdf(db: Session, *, to_phone: str, pdf_path: str, filename: str, caption: str | None = None, appointment_id: int | None = None, invoice_id: int | None = None, created_by_user_id: int | None = None) -> dict[str, Any]:
    media_id = upload_media(pdf_path, mime_type="application/pdf")
    return send_document_message_by_media_id(db, to_phone=to_phone, media_id=media_id, filename=filename, caption=caption, message_type="invoice_pdf_document", appointment_id=appointment_id, invoice_id=invoice_id, created_by_user_id=created_by_user_id)


def send_template_message(db: Session, *, to_phone: str, template_name: str, language_code: str, components: list[dict], message_type: str, appointment_id: int | None = None, invoice_id: int | None = None, created_by_user_id: int | None = None):
    to_phone = _normalize_to_phone(to_phone)
    payload = {"messaging_product": "whatsapp", "to": to_phone, "type": "template", "template": {"name": template_name, "language": {"code": language_code}, "components": components}}
    log = _create_notification_log(db, appointment_id=appointment_id, invoice_id=invoice_id, created_by_user_id=created_by_user_id, message_type=message_type, recipient_phone=to_phone, payload=str(payload))
    response = requests.post(_messages_url(), headers=_headers_json(), json=payload, timeout=60)
    if response.status_code >= 400:
        log.status = "failed"
        log.failure_reason = response.text
        raise RuntimeError(f"Meta template message failed: {response.status_code} - {response.text}")
    res = response.json()
    log.status = "sent"
    log.provider_message_id = (res.get("messages", [{}])[0].get("id") if isinstance(res.get("messages"), list) else None)
    return res


def send_booking_confirmation_template(db: Session, *, to_phone: str, customer_name: str, appointment_date: str, appointment_time: str, barber_name: str, appointment_id: int | None = None):
    return send_template_message(db, to_phone=to_phone, template_name="booking_confirmation_utility", language_code="ar", components=[{"type": "body", "parameters": [{"type": "text", "text": customer_name}, {"type": "text", "text": appointment_date}, {"type": "text", "text": appointment_time}, {"type": "text", "text": barber_name}]}], message_type="booking_confirmation_template", appointment_id=appointment_id)


def send_appointment_reminder_24h_template(db: Session, *, to_phone: str, customer_name: str, appointment_date: str, appointment_time: str, barber_name: str, appointment_id: int | None = None):
    return send_template_message(db, to_phone=to_phone, template_name="appointment_reminder_24h_utility", language_code="ar", components=[{"type": "body", "parameters": [{"type": "text", "text": customer_name}, {"type": "text", "text": appointment_date}, {"type": "text", "text": appointment_time}, {"type": "text", "text": barber_name}]}], message_type="appointment_reminder_24h_template", appointment_id=appointment_id)


def send_appointment_reminder_2h_template(db: Session, *, to_phone: str, appointment_time: str, barber_name: str, appointment_id: int | None = None):
    return send_template_message(db, to_phone=to_phone, template_name="appointment_reminder_2h_utility", language_code="ar", components=[{"type": "body", "parameters": [{"type": "text", "text": appointment_time}, {"type": "text", "text": barber_name}]}], message_type="appointment_reminder_2h_template", appointment_id=appointment_id)


def update_logs_from_webhook_payload(db: Session, payload: dict[str, Any]) -> int:
    updated_logs = 0
    entries = payload.get("entry") if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        return 0

    for entry in entries:
        changes = entry.get("changes", []) if isinstance(entry, dict) else []
        for change in changes:
            value = change.get("value", {}) if isinstance(change, dict) else {}
            statuses = value.get("statuses", []) if isinstance(value, dict) else []
            for status_item in statuses:
                provider_message_id = status_item.get("id")
                if not provider_message_id:
                    continue

                log = (
                    db.query(NotificationLog)
                    .filter(NotificationLog.provider_message_id == provider_message_id)
                    .first()
                )
                if not log:
                    continue

                mapped_status = status_item.get("status") or log.status
                log.status = mapped_status
                if mapped_status in {"sent", "delivered", "read"}:
                    log.sent_at = log.sent_at or datetime.utcnow()
                errors = status_item.get("errors")
                if isinstance(errors, list) and errors:
                    first_error = errors[0]
                    if isinstance(first_error, dict):
                        log.failure_reason = first_error.get("title") or first_error.get("message")
                db.add(log)
                updated_logs += 1

    if updated_logs:
        db.commit()
    return updated_logs
