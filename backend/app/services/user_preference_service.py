from sqlalchemy.orm import Session

from app.models.user import User
from app.models.preference import Preference as UserPreference


def get_or_create_preferences(db: Session, user: User):
    prefs = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if prefs:
        return prefs

    prefs = UserPreference(
        user_id=user.id,
        language="ar",
        theme="light",
        notifications_enabled=True,
    )
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


def update_preferences(db: Session, user: User, payload):
    prefs = get_or_create_preferences(db, user)
    prefs.language = payload.language
    prefs.theme = payload.theme
    prefs.notifications_enabled = payload.notifications_enabled

    db.commit()
    db.refresh(prefs)
    return prefs
