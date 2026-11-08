"""One barber, one chair.

Three defects meet in this file, and they are the same defect seen from three
places: nothing in the database said that a booking slot is exclusive.

`create_public_booking` asked Python whether a barber was free and then
inserted. Two requests in the same instant both got "free". Separately, the
question they asked was itself wrong -- the busy list was an allow-list of
`("pending", "confirmed", "waiting")`, so an appointment in `in-service` (the
barber is cutting someone's hair right now) or `ready_for_payment` was not
considered busy at all and its slot was offered to the next visitor.

The fixes are deliberately redundant with each other: the scheduler's query,
the shared predicate in `app/core/booking_status.py`, and the partial unique
index on `appointments` must all agree, because a check that only exists in one
of the three is a check that one code path can walk past.
"""
from datetime import date, time
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.api.v1.endpoints.business_settings import (
    PUBLIC_SNAPSHOT_FIELDS,
    _public_site_is_stale,
    _snapshot_of,
)
from app.api.v1.endpoints.appointments import APPOINTMENT_STATUSES
from app.core.booking_status import RELEASED_BOOKING_STATUSES
from app.models.appointment import Appointment
from app.models.business_settings import BusinessSettings
from app.models.customer import Customer
from app.models.employee import Employee
from app.services import booking_scheduler

DAY = date(2030, 3, 14)
SLOT = time(12, 0)


def _barber(db_session, name="Barber A", phone="01099900001"):
    employee = Employee(
        full_name=name,
        phone_primary=phone,
        job_title="barber",
        commission_rate=Decimal("15"),
    )
    db_session.add(employee)
    db_session.commit()
    db_session.refresh(employee)
    return employee


def _customer(db_session, phone="01088800001"):
    customer = Customer(first_name="Test", last_name="Customer", phone=phone)
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


def _booking(db_session, customer, employee, *, at=SLOT, status="pending", duration=30):
    appointment = Appointment(
        customer_id=customer.customer_id,
        barber_id=employee.id,
        appointment_date=DAY,
        appointment_time=at,
        status=status,
        notes="pytest fixture",
        total_estimated_price=Decimal("100"),
        total_estimated_duration_minutes=duration,
    )
    db_session.add(appointment)
    db_session.commit()
    db_session.refresh(appointment)
    return appointment


def test_two_live_bookings_cannot_share_one_slot(db_session):
    """The constraint the whole feature was missing.

    Asserted as an `IntegrityError` rather than as a rejected HTTP call,
    because the point is that the *database* refuses. An application-level
    check can be walked past by the next endpoint that creates an appointment;
    this cannot.
    """
    employee = _barber(db_session)
    first = _customer(db_session, "01088800001")
    second = _customer(db_session, "01088800002")
    _booking(db_session, first, employee)

    with pytest.raises(IntegrityError):
        _booking(db_session, second, employee)

    db_session.rollback()
    assert db_session.query(Appointment).count() == 1


def test_a_released_booking_frees_its_slot(db_session):
    """A cancelled booking must not keep blocking the chair it gave back.

    This is why the index is partial. A plain
    `UNIQUE(barber_id, appointment_date, appointment_time)` would make a slot
    unusable forever after one cancellation, and the fix for that would be to
    delete the cancelled row -- destroying the record that the customer
    cancelled.
    """
    employee = _barber(db_session)
    first = _customer(db_session, "01088800001")
    second = _customer(db_session, "01088800002")
    booking = _booking(db_session, first, employee)

    booking.status = "cancelled"
    db_session.commit()

    replacement = _booking(db_session, second, employee)
    assert replacement.id != booking.id


def test_a_booking_in_progress_still_owns_its_slot(db_session):
    """The allow-list bug, kept from coming back.

    `in-service` and `ready_for_payment` were absent from
    `ACTIVE_BOOKING_STATUSES`, so `_build_busy_intervals` returned nothing for
    them and the scheduler offered a barber's current appointment to the public
    site as if the chair were empty.
    """
    employee = _barber(db_session)
    customer = _customer(db_session)

    for status in ("in-service", "ready_for_payment", "completed", "pending", "waiting"):
        db_session.query(Appointment).delete()
        db_session.commit()
        _booking(db_session, customer, employee, status=status)

        intervals, count = booking_scheduler._build_busy_intervals(
            db_session, employee_id=employee.id, booking_date=DAY
        )
        assert count == 1, f"a {status} appointment was treated as a free slot"
        assert intervals and intervals[0][0].time() == SLOT

    # And the released states are genuinely released.
    for status in RELEASED_BOOKING_STATUSES:
        db_session.query(Appointment).delete()
        db_session.commit()
        _booking(db_session, customer, employee, status=status)
        _intervals, count = booking_scheduler._build_busy_intervals(
            db_session, employee_id=employee.id, booking_date=DAY
        )
        assert count == 0, f"a {status} appointment still blocked its slot"


def test_the_released_list_is_a_real_subset_of_the_vocabulary():
    """A deny-list is only safe while it names every status that releases.

    `appointments.py` validates incoming status strings against
    `APPOINTMENT_STATUSES`. If someone adds a releasing status there and not
    here, bookings that should free a chair keep holding it, and the failure is
    a slot that can never be booked -- invisible until a customer complains.
    """
    assert set(RELEASED_BOOKING_STATUSES) <= APPOINTMENT_STATUSES


def _settings(**overrides):
    row = BusinessSettings(
        salon_name="Salon Pro",
        currency="EGP",
        landing_theme_id="moss",
        public_site_published_version=20,
        version=20,
    )
    for key, value in overrides.items():
        setattr(row, key, value)
    return row


def test_staleness_catches_drift_the_version_counters_miss():
    """The counter is not the content.

    At least one database this branch has been run against has
    `landing_theme_id = 'moss'` on the row, `'gold'` inside the published
    snapshot, and `version == public_site_published_version == 20`. The owner
    chose a palette, the admin panel showed it saved and "published", and the
    public site kept serving the old one -- because the only thing that was
    compared was two integers that happened to agree.
    """
    row = _settings()
    row.public_site_snapshot = {**_snapshot_of(row), "landing_theme_id": "gold"}

    assert int(row.version) == int(row.public_site_published_version)
    assert _public_site_is_stale(row) is True

    # Publishing rewrites the snapshot from the row, and the flag clears.
    row.public_site_snapshot = _snapshot_of(row)
    assert _public_site_is_stale(row) is False


def test_every_snapshot_field_is_readable_on_the_model():
    """A typo in `PUBLIC_SNAPSHOT_FIELDS` silently pins that field to `None`.

    `getattr(row, name, None)` swallows the mistake, the owner's value never
    reaches the public site, and nothing anywhere reports it -- which is the
    same class of bug the comment above the list describes for the fields that
    had been left out of it entirely.
    """
    row = _settings()
    for name in PUBLIC_SNAPSHOT_FIELDS:
        assert hasattr(row, name), f"{name} is snapshotted but is not a column"
