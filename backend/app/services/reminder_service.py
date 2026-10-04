from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.employee import Employee
from app.services.meta_whatsapp_service import send_appointment_reminder_24h_template, send_appointment_reminder_2h_template


def send_due_reminders(db: Session):
    now = datetime.now()
    target_24h_from = now + timedelta(hours=23, minutes=45)
    target_24h_to = now + timedelta(hours=24, minutes=15)
    target_2h_from = now + timedelta(hours=1, minutes=45)
    target_2h_to = now + timedelta(hours=2, minutes=15)

    appointments = db.query(Appointment).all()
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
        appointment_dt = datetime.combine(appointment.appointment_date, appointment.appointment_time)
        customer = customers_by_id.get(appointment.customer_id)
        barber = barbers_by_id.get(appointment.barber_id)
        if not customer or not customer.phone:
            continue
        if not appointment.reminder_24h_sent and target_24h_from <= appointment_dt <= target_24h_to:
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
        if not appointment.reminder_2h_sent and target_2h_from <= appointment_dt <= target_2h_to:
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
