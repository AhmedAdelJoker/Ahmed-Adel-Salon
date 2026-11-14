from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import validate_password_strength

# Hard ceiling on stored overrides. The frontend matrix has ~40 pages; 500
# leaves headroom without letting a payload grow unbounded.
MAX_PERMISSION_KEYS = 500


def normalize_permissions(value: object) -> Optional[dict]:
    """Validate the per-user override map: {permission_key: bool}.

    Rejects anything that is not a plain string->bool mapping so a malformed
    payload can never reach the JSON column or the consumers reading it.
    """
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("permissions must be an object of {key: boolean}")
    if len(value) > MAX_PERMISSION_KEYS:
        raise ValueError(f"permissions supports at most {MAX_PERMISSION_KEYS} keys")
    normalized: dict = {}
    for key, allowed in value.items():
        if not isinstance(key, str) or not key.strip() or len(key) > 200:
            raise ValueError("permission keys must be non-empty strings (max 200 chars)")
        if not isinstance(allowed, bool):
            raise ValueError(f"permission '{key}' must be a boolean")
        normalized[key] = allowed
    return normalized


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: str = "cashier"
    barber_id: Optional[int] = None
    is_active: bool = True
    permissions: Optional[dict] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("permissions")
    @classmethod
    def validate_create_permissions(cls, value: Optional[dict]) -> Optional[dict]:
        return normalize_permissions(value)


class UserUpdate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: Optional[str] = ""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: str = "cashier"
    barber_id: Optional[int] = None
    is_active: bool = True
    permissions: Optional[dict] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: Optional[str]) -> Optional[str]:
        if value and value != "":
            return validate_password_strength(value)
        return value or None

    @field_validator("permissions")
    @classmethod
    def validate_update_permissions(cls, value: Optional[dict]) -> Optional[dict]:
        return normalize_permissions(value)


class UserRead(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    barber_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    profile_image_url: Optional[str] = None
    job_title: Optional[str] = None
    permissions: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class UserRoleUpdate(BaseModel):
    role: str


class UserActiveUpdate(BaseModel):
    is_active: bool
