"""The appointment status vocabulary, and the one question the scheduler asks it.

Two modules used to carry their own copy of "which appointments count as busy",
both written as an allow-list of the three states a booking passes through on
its way in:

    ACTIVE_BOOKING_STATUSES = ("pending", "confirmed", "waiting")

The lifecycle is not three states. `booking_pos_bridge` moves a booking through
`in-service` and then `ready_for_payment` before it is `completed`, and an
appointment sitting in either of those two is the barber *currently cutting
someone's hair*. Read against the allow-list, that appointment was invisible:
the public site offered the slot it occupies, and the workstation's own
conflict checks accepted a second booking over it. A deny-list of the states
that *release* the chair cannot make that mistake, because a new status is
busy by default rather than free by default.

The same predicate is what the partial unique index on `appointments` is built
from, so the query and the constraint cannot drift into disagreeing about which
rows they cover.
"""

from __future__ import annotations

#: Statuses in which the appointment no longer occupies the barber's time.
RELEASED_BOOKING_STATUSES: tuple[str, ...] = (
    "cancelled",
    "auto_cancelled",
    "no_show",
)


def holds_barber_time():
    """SQLAlchemy clause matching every appointment that still owns its slot."""
    from app.models.appointment import Appointment

    return Appointment.status.notin_(RELEASED_BOOKING_STATUSES)
