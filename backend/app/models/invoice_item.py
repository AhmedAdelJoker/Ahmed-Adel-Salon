from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        # Bounded to `Base.metadata.create_all` so a fresh database gets the
        # lookup too, and not only the runtime/legacy backfill below it.
        Index("ix_invoice_items_invoice_id", "invoice_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    # The staff member who performed this line. Null for products (no service
    # attribution) and for lives before the per-line attribution existed.
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=True, index=True)

    service_name = Column(String(255), nullable=False)

    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    total_price = Column(Numeric(10, 2), nullable=False, default=0)
    commission_amount = Column(Numeric(10, 2), nullable=True, default=0)

    invoice = relationship("Invoice", back_populates="items")
    service = relationship("Service", back_populates="invoice_items")