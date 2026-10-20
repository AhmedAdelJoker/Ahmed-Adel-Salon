from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class InventoryLog(Base):
    """One row per stock movement.

    `source_type` / `source_id` identify *what caused* the movement, and the
    unique constraint on (source_type, source_id, product_id) is what makes a
    deduction idempotent.

    Why this exists
    ---------------
    Stock was previously deducted from three independent places: creating a
    service session, completing that session, and issuing the invoice. A single
    haircut could therefore decrement the same product two or three times, and
    nothing in the schema recorded which invoice or session had already been
    applied. The quantities were simply wrong, with no way to detect it after
    the fact.

    Application-level "have I already done this?" checks are not sufficient
    here: two requests can both pass the check before either writes. The
    constraint is the only place where the guarantee actually holds, so it
    lives in the database and the service layer treats a uniqueness violation
    as "already applied, skip it".

    Nullable by design: manual adjustments made from the inventory screen have
    no source document. SQL treats each NULL as distinct, so those rows are
    never constrained against each other.
    """

    __tablename__ = "inventory_logs"
    __table_args__ = (
        UniqueConstraint(
            "source_type",
            "source_id",
            "product_id",
            name="uq_inventory_logs_source_product",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    change_amount = Column(Numeric(10, 2), nullable=False)
    type = Column(String(50), nullable=False)
    note = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # "invoice" | "session" | "appointment" — NULL for manual stock edits.
    source_type = Column(String(30), nullable=True, index=True)
    source_id = Column(Integer, nullable=True, index=True)

    product = relationship("Product", back_populates="inventory_logs")
    created_by_user = relationship("User")
