from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        Index("ix_invoices_barber_created", "barber_id", "created_at"),
        Index("ix_invoices_created_draft", "created_at", "is_draft"),
        UniqueConstraint(
            "created_by_user_id",
            "idempotency_key",
            name="uq_invoices_creator_idempotency_key",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String(50), unique=True, nullable=False, index=True)

    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False, index=True)
    barber_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)

    payment_method = Column(String(30), nullable=False, default="cash")
    subtotal_amount = Column(Numeric(10, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(10, 2), nullable=False, default=0)
    total_amount = Column(Numeric(10, 2), nullable=False, default=0)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    idempotency_key = Column(String(128), nullable=True)
    request_hash = Column(String(64), nullable=True)
    pdf_path = Column(String(500), nullable=True)

    is_closed = Column(Boolean, default=False, nullable=False, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_draft = Column(Boolean, default=False, nullable=False, index=True)
    draft_saved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    appointment = relationship("Appointment", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")
    barber = relationship("Employee", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    closed_by_user = relationship("User", foreign_keys=[closed_by_user_id])
    discount_approval_requests = relationship(
        "DiscountApprovalRequest",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
    adjustment_requests = relationship(
        "InvoiceAdjustmentRequest",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
    payments = relationship(
        "InvoicePayment",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
