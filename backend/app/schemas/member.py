from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class MemberLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class MemberRegister(BaseModel):
    name: str = Field(min_length=1, max_length=201)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=30)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name", "email", "phone")
    @classmethod
    def strip_values(cls, value: str) -> str:
        return value.strip()

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        normalized = "".join(char for char in value if char.isdigit() or char == "+")
        if len(normalized) < 5:
            raise ValueError("رقم الهاتف غير صالح")
        return normalized


class MemberUserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str
    loyaltyPoints: float = 0
    bookingsCount: int = 0
    rating: float | None = None
    streak: int = 0


class MemberAuthResponse(BaseModel):
    token: str
    user: MemberUserRead


class MemberBookingRead(BaseModel):
    id: int
    status: str
    scheduledAt: datetime
    serviceName: str
    barberName: str | None = None
