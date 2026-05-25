from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps_auth import get_current_active_user
from app.models.user import User
from app.models.preference import Preference

router = APIRouter(prefix="/preferences", tags=["Preferences"])


class PreferenceRead(BaseModel):
    id: Optional[int] = None
    user_id: Optional[int] = None
    language: str = "ar"
    theme: str = "dark"
    notifications_enabled: bool = True

    model_config = ConfigDict(from_attributes=True)


class PreferenceUpdate(BaseModel):
    language: Optional[str] = Field(default=None, max_length=10)
    theme: Optional[str] = Field(default=None, max_length=20)
    notifications_enabled: Optional[bool] = None


def _get_or_create_preference(db: Session, user_id: int) -> Preference:
    row = db.query(Preference).filter(Preference.user_id == user_id).first()

    if row:
        return row

    row = Preference(
        user_id=user_id,
        language="ar",
        theme="dark",
        notifications_enabled=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=PreferenceRead)
def read_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    row = _get_or_create_preference(db, current_user.id)
    return row


@router.put("", response_model=PreferenceRead)
def update_preferences(
    payload: PreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    row = _get_or_create_preference(db, current_user.id)

    if payload.language is not None:
        row.language = payload.language

    if payload.theme is not None:
        row.theme = payload.theme

    if payload.notifications_enabled is not None:
        row.notifications_enabled = payload.notifications_enabled

    db.add(row)
    db.commit()
    db.refresh(row)

    return row