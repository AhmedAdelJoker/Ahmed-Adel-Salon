from datetime import date, timedelta
from decimal import Decimal

from app.models.employee import Employee
from app.models.service import Service
from tests.helpers import auth_headers, make_user
from tests.test_dashboard import _seed_customer


def _tomorrow():
    return (date.today() + timedelta(days=1)).isoformat()


def _seed_barber(db_session):
    barber = Employee(full_name="Barber One", phone_primary="01009998888", job_title="barber")
    db_session.add(barber)
    db_session.commit()
    db_session.refresh(barber)
    return barber


def _seed_service(db_session):
    service = Service(name="Cut", price=Decimal("100"), duration_minutes=30)
    db_session.add(service)
    db_session.commit()
    db_session.refresh(service)
    return service


def _payload(customer_id, barber_id, service_id, time="10:00"):
    return {
        "customer_id": customer_id,
        "barber_id": barber_id,
        "appointment_date": _tomorrow(),
        "appointment_time": time,
        "services": [{"service_id": service_id, "quantity": 1}],
    }


def _setup(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01007776666")
    barber = _seed_barber(db_session)
    service = _seed_service(db_session)
    return auth_headers(client), customer, barber, service


def test_create_appointment(client, db_session):
    headers, customer, barber, service = _setup(client, db_session)
    resp = client.post(
        "/api/v1/appointments",
        json=_payload(customer.customer_id, barber.id, service.id),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["customer_id"] == customer.customer_id


def test_create_appointment_overlap_conflict(client, db_session):
    headers, customer, barber, service = _setup(client, db_session)
    first = client.post(
        "/api/v1/appointments",
        json=_payload(customer.customer_id, barber.id, service.id, "10:00"),
        headers=headers,
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/api/v1/appointments",
        json=_payload(customer.customer_id, barber.id, service.id, "10:15"),
        headers=headers,
    )
    assert second.status_code == 409


def test_create_appointment_unknown_customer(client, db_session):
    headers, _, barber, service = _setup(client, db_session)
    resp = client.post(
        "/api/v1/appointments",
        json=_payload(999999, barber.id, service.id),
        headers=headers,
    )
    assert resp.status_code == 404


def test_create_appointment_past_date(client, db_session):
    headers, customer, barber, service = _setup(client, db_session)
    payload = _payload(customer.customer_id, barber.id, service.id)
    payload["appointment_date"] = (date.today() - timedelta(days=1)).isoformat()
    resp = client.post("/api/v1/appointments", json=payload, headers=headers)
    assert resp.status_code == 400


def test_create_appointment_requires_auth(client):
    resp = client.post(
        "/api/v1/appointments",
        json=_payload(1, 1, 1),
    )
    assert resp.status_code in (401, 403)
