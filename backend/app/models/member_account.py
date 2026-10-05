from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class MemberAccount(Base):
    """Public-booking credentials for a customer, split out of ``customers``.

    A customer row is business data (name, loyalty, spend). Login material is a
    different concern with a different lifecycle: it can be deactivated without
    touching the customer, rotated independently, and must never be selected by
    the many list/aggregate queries that read ``customers``. Keeping the hash on
    the customer table meant every ``SELECT`` dragged credential columns along.
    """

    __tablename__ = "member_accounts"
    __table_args__ = (
        UniqueConstraint("customer_id", name="uq_member_accounts_customer_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(
        Integer,
        ForeignKey("customers.customer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    password_hash = Column(String(255), nullable=False)
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    is_active = Column(Boolean, nullable=False, default=True, server_default="1")
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    customer = relationship("Customer", back_populates="member_account")
