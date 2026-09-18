from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class RevokedToken(Base):
    """JWT denylist — makes logout / refresh-rotation / password-change effective.

    A token whose ``jti`` is present here MUST be rejected even if its
    signature is valid and it has not expired yet. Rows with
    ``expires_at`` in the past are purged opportunistically and can be
    deleted safely at any time.
    """

    __tablename__ = "revoked_tokens"

    jti = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    token_type = Column(String(16), nullable=False, default="access")
    reason = Column(String(64), nullable=False, default="logout")
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    revoked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
