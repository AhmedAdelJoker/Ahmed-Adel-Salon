from sqlalchemy import (
    Column,
    Index,
    Integer,
    String,
    Numeric,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class AppointmentService(Base):
    __tablename__ = "appointment_services"

    # Indexed: every `selectinload(Appointment.services)` filters on this
    # column, and four barber endpoints perform that load.
    #
    # Named explicitly rather than via `index=True`. `index=True` generates
    # `ix_appointment_services_appointment_id`, while `runtime_schema` and
    # migration `b4f1c2d8a90e` both create `ix_appointment_services_appointment`
    # for the same column. On a database built by `create_all` -- which is what
    # the test suite does -- the two paths disagree and you end up with two
    # identical indexes on one column, costing writes and disk for nothing.
    __table_args__ = (
        Index("ix_appointment_services_appointment", "appointment_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    appointment_id = Column(
        Integer, ForeignKey("appointments.id"), nullable=False
    )
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)

    service_name_snapshot = Column(String(255), nullable=False)
    price_snapshot = Column(Numeric(10, 2), nullable=False, default=0)
    duration_snapshot_minutes = Column(Integer, nullable=False, default=0)

    quantity = Column(Integer, nullable=False, default=1)

    is_active = Column(Boolean, nullable=False, default=True)
    is_changed = Column(Boolean, nullable=False, default=False)
    change_note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    appointment = relationship("Appointment", back_populates="services")
    service = relationship("Service", back_populates="appointment_services")