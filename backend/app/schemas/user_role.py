from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: str = "cashier"
    barber_id: Optional[int] = None
    is_active: bool = True

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class UserUpdate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: Optional[str] = ""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: str = "cashier"
    barber_id: Optional[int] = None
    is_active: bool = True

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: Optional[str]) -> Optional[str]:
        if value and value != "":
            return validate_password_strength(value)
        return value or None


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

    model_config = ConfigDict(from_attributes=True)


class UserRoleUpdate(BaseModel):
    role: str


class UserActiveUpdate(BaseModel):
    is_active: bool
