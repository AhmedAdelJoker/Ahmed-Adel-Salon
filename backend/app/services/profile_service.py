from sqlalchemy.orm import Session
from app.models.user import User


def get_profile(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
    }


def update_profile(db: Session, user: User, payload):
    user.full_name = payload.full_name
    user.username = payload.username
    user.email = payload.email

    db.commit()
    db.refresh(user)
    return user