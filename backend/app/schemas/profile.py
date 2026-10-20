from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class ProfileRead(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    barber_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    profile_image_url: Optional[str] = None
    display_name: Optional[str] = None
    bio_ar: Optional[str] = None
    totp_enabled: bool = False
    # Per-user page-access overrides consumed by the route guard, sidebar and
    # command palette. Absent/None means "role defaults apply".
    permissions: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[EmailStr] = Field(default=None)
    display_name: Optional[str] = Field(default=None, max_length=255)
    bio_ar: Optional[str] = Field(default=None)

    @field_validator("email", mode="before")
    @classmethod
    def blank_email_means_no_email(cls, value: object) -> object:
        """Treat an empty email as "no email", not as a validation failure.

        The email field on the profile form is optional and not `required`, so
        submitting it blank sent `""`. `EmailStr` rejects the empty string, and
        the user got a 422 with a Pydantic detail they could not act on — for
        having left an optional field alone.
        """
        if isinstance(value, str) and not value.strip():
            return None
        return value


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)
