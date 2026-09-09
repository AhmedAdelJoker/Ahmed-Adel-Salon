"""
Booking Status Enum — Single Source of Truth for Backend
=========================================================
This enum ensures that ONLY valid status values can be stored in the database.
Any attempt to insert an invalid status will be rejected by Pydantic validation.
"""

import enum


class AppointmentStatus(str, enum.Enum):
    """Canonical appointment status values.
    
    These are the ONLY valid values that can be stored in the appointments.status column.
    The string values match exactly what's stored in the database.
    """
    
    PENDING = "pending"
    CONFIRMED = "confirmed"
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    READY_FOR_PAYMENT = "ready_for_payment"
    DONE = "done"
    CANCELLED = "cancelled"
    AUTO_CANCELLED = "auto_cancelled"

    @classmethod
    def from_raw(cls, value: str) -> "AppointmentStatus":
        """Convert a raw string to AppointmentStatus, handling common variations."""
        value = str(value or "").strip().lower()
        
        # Direct match
        try:
            return cls(value)
        except ValueError:
            pass
        
        # Handle legacy/variant forms
        VARIANT_MAP = {
            "scheduled": cls.PENDING,
            "in-service": cls.IN_PROGRESS,
            "ready_for_pos": cls.READY_FOR_PAYMENT,
            "paid": cls.DONE,
            "invoiced": cls.DONE,
            "closed": cls.DONE,
            "at_reception": cls.COMPLETED,
            "at_cashier": cls.READY_FOR_PAYMENT,
            "active_board": cls.WAITING,
        }
        
        result = VARIANT_MAP.get(value)
        if result:
            return result
        
        raise ValueError(f"Invalid appointment status: '{value}'")

    @property
    def is_active(self) -> bool:
        """Check if this status represents an active (non-terminal) booking."""
        return self in {
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.WAITING,
            AppointmentStatus.IN_PROGRESS,
            AppointmentStatus.COMPLETED,
            AppointmentStatus.READY_FOR_PAYMENT,
        }

    @property
    def is_terminal(self) -> bool:
        """Check if this status is terminal (done or cancelled)."""
        return self in {
            AppointmentStatus.DONE,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.AUTO_CANCELLED,
        }

    @property
    def is_cancellable(self) -> bool:
        """Check if a booking in this status can be cancelled by user action."""
        return self in {
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.WAITING,
        }


# Grouped status categories for filtering
STATUS_GROUPS = {
    "scheduling": [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
    "active": [AppointmentStatus.WAITING, AppointmentStatus.IN_PROGRESS],
    "reception": [AppointmentStatus.COMPLETED, AppointmentStatus.READY_FOR_PAYMENT],
    "closed": [AppointmentStatus.DONE],
    "cancelled": [AppointmentStatus.CANCELLED, AppointmentStatus.AUTO_CANCELLED],
}

# All active statuses (not cancelled, not done)
ACTIVE_STATUSES = (
    STATUS_GROUPS["scheduling"]
    + STATUS_GROUPS["active"]
    + STATUS_GROUPS["reception"]
)


class BookingSource(str, enum.Enum):
    """Booking source values."""
    SHOP = "shop"
    ONLINE = "online"


class RecurrencePattern(str, enum.Enum):
    """Recurrence pattern values for recurring appointments."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class WaitlistStatus(str, enum.Enum):
    """Waitlist entry status values."""
    WAITING = "waiting"
    NOTIFIED = "notified"
    BOOKED = "booked"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
