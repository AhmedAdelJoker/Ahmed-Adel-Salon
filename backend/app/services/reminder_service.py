from datetime import datetime, timedelta

import logging
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.employee import Employee
from app.core.clock import salon_now
from app.services.meta_whatsapp_service import send_appointment_reminder_24h_template, send_appointment_reminder_2h_template

logger = logging.getLogger(__name__)

#: Visits that no longer need reminding about. `cancelled` means the customer
#: backed out themselves and `no_show` means the visit has already passed them
#: by -- both come out of the same terminal states the appointment state machine
#: (barber.py, KNOWN_APPOINTMENT_STATUSES) keeps. Reminding a customer about a
#: visit they cancelled is worse than reminding them about nothing, and both
#: rows can sit inside the windows below for days.
SKIP_REMINDER_STATUSES = ("cancelled", "no_show")


def send_due_reminders(db: Session):
    # Salon wall-clock, not `datetime.now()`.
    #
    # The window below is compared against
    # `datetime.combine(appointment.appointment_date, appointment.appointment_time)`
    # -- a wall-clock reading built from two business columns. Comparing that to
    # the *server's* clock compares two different timezones, and the two do not
    # cancel: the comparison is off by the offset. On a UTC server with a Cairo
    # salon, the 24h and 2h windows are both three hours late, so customers are
    # reminded at the wrong time and appointments close to the window edge are
    # skipped entirely.
    now = salon_now()
    target_24h_from = now + timedelta(hours=23, minutes=45)
    target_24h_to = now + timedelta(hours=24, minutes=15)
    target_2h_from = now + timedelta(hours=1, minutes=45)
    target_2h_to = now + timedelta(hours=2, minutes=15)

    # Both windows always read the future on the salon clock, and a wall clock
    # is built from `appointment_date`, so every row this run could send for
    # has its date between the 2h window's floor and the 24h window's ceiling.
    # Filtering on that keeps the scan to (at worst) two days of appointments
    # instead of the shop's whole history, every fifteen minutes.
    min_date = target_2h_from.date()
    max_date = target_24h_to.date()
    appointments = (
        db.query(Appointment)
        .filter(Appointment.appointment_date.between(min_date, max_date))
        .all()
    )
    if not appointments:
        return

    # Phase 2: prefetch customers + employees once instead of two queries per
    # appointment. Previously this ran 2N+1 queries on every scheduler tick.
    customer_ids = {a.customer_id for a in appointments if a.customer_id is not None}
    barber_ids = {a.barber_id for a in appointments if a.barber_id is not None}

    customers_by_id = {}
    if customer_ids:
        for c in db.query(Customer).filter(Customer.customer_id.in_(customer_ids)).all():
            customers_by_id[c.customer_id] = c

    barbers_by_id = {}
    if barber_ids:
        for e in db.query(Employee).filter(Employee.id.in_(barber_ids)).all():
            barbers_by_id[e.id] = e

    for appointment in appointments:
        if appointment.status in SKIP_REMINDER_STATUSES:
            continue

        customer = customers_by_id.get(appointment.customer_id)
        barber = barbers_by_id.get(appointment.barber_id)
        if not customer or not customer.phone:
            continue

        appointment_dt = datetime.combine(appointment.appointment_date, appointment.appointment_time)

        # One failing message must not erase the rest of the batch: WhatsApp is
        # real network I/O with a 60s timeout, so a dead number or an API
        # outage used to raise the loop out of `send_due_reminders` entirely --
        # the two remaining appointments got nothing AND, because nothing was
        # committed until the end, every message already delivered in this run
        # was un-flagged, so the next tick sent it to those customers AGAIN.
        # Each successful send therefore commits its own sent-flag together
        # with the notification log it produced, and a failure rolls back only
        # its own attempt and moves on.
        if not appointment.reminder_24h_sent and target_24h_from <= appointment_dt <= target_24h_to:
            try:
                send_appointment_reminder_24h_template(
                    db,
                    to_phone=customer.phone,
                    customer_name=f"{customer.first_name} {customer.last_name}".strip(),
                    appointment_date=str(appointment.appointment_date),
                    appointment_time=str(appointment.appointment_time),
                    barber_name=barber.display_name if barber else "-",
                    appointment_id=appointment.id,
                )
                appointment.reminder_24h_sent = True
                db.add(appointment)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception(
                    "24h reminder failed for appointment %s; it will retry on the next tick",
                    appointment.id,
                )
        if not appointment.reminder_2h_sent and target_2h_from <= appointment_dt <= target_2h_to:
            try:
                send_appointment_reminder_2h_template(
                    db,
                    to_phone=customer.phone,
                    appointment_time=str(appointment.appointment_time),
                    barber_name=barber.display_name if barber else "-",
                    appointment_id=appointment.id,
                )
                appointment.reminder_2h_sent = True
                db.add(appointment)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception(
                    "2h reminder failed for appointment %s; it will retry on the next tick",
                    appointment.id,
                )