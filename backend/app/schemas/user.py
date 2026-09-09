from pydantic import BaseModel, ConfigDict, EmailStr

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class UserBase(BaseModel):
    username: str
    full_name: str | None = None
    email: str | None = None
    role: str
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    email: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None



class UserRoleUpdate(BaseModel):
    role: str
    barber_id: Optional[int] = None


class UserActiveUpdate(BaseModel):
    is_active: bool

class UserRead(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    barber_id: Optional[int] = None
    is_active: bool
    created_at: datetime

    
    model_config = ConfigDict(from_attributes=True)


class PaginatedUsersRead(BaseModel):
    items: list[UserRead] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 1


# ===== Profile aliases / compatibility =====

class UserProfileRead(BaseModel):
    id: int
    username: str
    full_name: str | None = None
    email: str | None = None
    role: str
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    email: str | None = None