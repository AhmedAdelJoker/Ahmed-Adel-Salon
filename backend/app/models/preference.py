from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Preference(Base):
    __tablename__ = "preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    language = Column(String(10), nullable=False, default="ar")
    theme = Column(String(20), nullable=False, default="dark")
    notifications_enabled = Column(Boolean, nullable=False, default=True)

    # Per-event notification switches.
    #
    # `notifications_enabled` alone is a master flag, so the six individual
    # toggles the barber profile renders had nowhere to be stored and were
    # discarded on save. Shape (every key optional; defaults applied on read):
    #
    #   {"new_appointment": true, "appointment_reminder": true,
    #    "appointment_cancelled": true, "shift_reminder": true,
    #    "tips": true, "marketing": false}
    #
    # Nullable on purpose: a row predating this column reads as "no granular
    # preferences stored yet", which is distinct from "every event is on".
    notification_preferences = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="preference")