from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.db.session import get_db
from app.models.user import User
from app.services.activity_service import log_activity
from app.services.runtime_settings_service import (
    get_runtime_settings,
    update_runtime_settings,
)

router = APIRouter(prefix="/security/settings", tags=["Security Settings"])

DEFAULT_SECURITY_SETTINGS = {
    "enforceStrongPasswords": True,
    "requireShiftForSales": True,
    "lockClosedShiftEdits": True,
    "enableActivityLogs": True,
    "restrictExportsToManagers": True,
    "requireDiscountApproval": True,
    "sessionTimeoutMinutes": 60,
    "maxFailedLoginAttempts": 5,
}


class SecuritySettingsPayload(BaseModel):
    enforce_strong_passwords: bool = True
    require_shift_for_sales: bool = True
    lock_closed_shift_edits: bool = True
    enable_activity_logs: bool = True
    restrict_exports_to_managers: bool = True
    require_discount_approval: bool = True
    session_timeout_minutes: int = 60
    max_failed_login_attempts: int = 5

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


def _sanitize_settings(data: dict) -> dict:
    merged = {**DEFAULT_SECURITY_SETTINGS, **(data or {})}
    merged["sessionTimeoutMinutes"] = max(
        5, int(merged.get("sessionTimeoutMinutes", 60) or 60)
    )
    merged["maxFailedLoginAttempts"] = max(
        1, int(merged.get("maxFailedLoginAttempts", 5) or 5)
    )
    return merged


@router.get("", response_model=SecuritySettingsPayload)
def read_security_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    del db, current_user
    return _sanitize_settings(
        get_runtime_settings("security_settings", DEFAULT_SECURITY_SETTINGS)
    )


@router.put("", response_model=SecuritySettingsPayload)
def update_security_settings(
    payload: SecuritySettingsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    previous = _sanitize_settings(
        get_runtime_settings("security_settings", DEFAULT_SECURITY_SETTINGS)
    )
    updated = _sanitize_settings(
        update_runtime_settings(
            "security_settings",
            payload.model_dump(by_alias=True),
            DEFAULT_SECURITY_SETTINGS,
        )
    )
    log_activity(
        db,
        user_id=current_user.id,
        action="update_security_settings",
        entity_type="security_settings",
        description="تم تحديث سياسات الأمان والوصول",
        old_values=previous,
        new_values=updated,
    )
    return updated



