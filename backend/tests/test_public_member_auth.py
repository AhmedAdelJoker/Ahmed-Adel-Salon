from datetime import date, time, timedelta
from decimal import Decimal

from app.api.v1.endpoints import booking_public
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.appointment_service import AppointmentService
from app.models.employee import Employee
from app.models.service import Service


def _register(client):
    response = client.post(
        "/api/v1/public/member/register",
        json={
            "name": "Member User",
            "email": "member@example.com",
            "phone": "+201000000001",
            "password": "StrongPass123",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_member_register_login_me_and_logout(client):
    registered = _register(client)
    token = registered["token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert registered["user"]["email"] == "member@example.com"
    assert "member_password_hash" not in registered["user"]

    response = client.get("/api/v1/public/member/me", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == registered["user"]["id"]

    response = client.post(
        "/api/v1/public/member/login",
        json={"email": "member@example.com", "password": "StrongPass123"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == "member@example.com"

    response = client.post("/api/v1/public/member/logout", headers=headers)
    assert response.status_code == 200, response.text
    response = client.get("/api/v1/public/member/me", headers=headers)
    assert response.status_code == 401


def test_member_login_does_not_disclose_account_state(client):
    _register(client)

    response = client.post(
        "/api/v1/public/member/login",
        json={"email": "unknown@example.com", "password": "WrongPass123"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "البريد الإلكتروني أو كلمة المرور غير صحيحة"


def test_member_bookings_are_limited_to_authenticated_customer(client, db_session):
    registered = _register(client)
    customer_id = registered["user"]["id"]
    employee = Employee(
        full_name="Barber One",
        phone_primary="01000000002",
        job_title="barber",
        status="active",
        is_active=True,
    )
    db_session.add(employee)
    db_session.flush()
    appointment = Appointment(
        customer_id=customer_id,
        barber_id=employee.id,
        appointment_date=date(2026, 9, 30),
        appointment_time=time(18, 30),
        status="confirmed",
    )
    db_session.add(appointment)
    db_session.flush()
    db_session.add(
        AppointmentService(
            appointment_id=appointment.id,
            service_name_snapshot="haircut",
            price_snapshot=100,
            duration_snapshot_minutes=30,
            quantity=1,
            is_active=True,
        )
    )
    db_session.commit()

    response = client.get(
        "/api/v1/public/member/bookings",
        headers={"Authorization": f"Bearer {registered['token']}"},
    )

    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    assert response.json()[0]["serviceName"] == "haircut"
    assert response.json()[0]["barberName"] == "Barber One"


def test_registration_does_not_claim_existing_customer_contact(client, db_session):
    db_session.add(
        Customer(
            first_name="Existing",
            last_name="Customer",
            phone="+201000000009",
            email="existing@example.com",
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/public/member/register",
        json={
            "name": "New Account",
            "email": "existing@example.com",
            "phone": "+201000000009",
            "password": "StrongPass123",
        },
    )

    assert response.status_code == 409


def test_member_routes_require_authentication(client):
    assert client.get("/api/v1/public/member/me").status_code == 401
    assert client.get("/api/v1/public/member/bookings").status_code == 401


def test_public_booking_uses_authenticated_member_customer(client, db_session, monkeypatch):
    registered = _register(client)
    employee = Employee(
        full_name="Booking Barber",
        phone_primary="01000000003",
        job_title="barber",
        status="active",
        is_active=True,
        show_in_booking=True,
    )
    service = Service(
        name="Public haircut",
        price=Decimal("100"),
        duration_minutes=30,
        is_active=True,
    )
    db_session.add_all([employee, service])
    db_session.commit()
    db_session.refresh(employee)
    db_session.refresh(service)

    monkeypatch.setattr(
        booking_public.booking_scheduler,
        "get_available_barbers_for_slot",
        lambda *args, **kwargs: [employee],
    )
    monkeypatch.setattr(
        booking_public,
        "send_booking_confirmation_template",
        lambda *args, **kwargs: None,
    )

    response = client.post(
        "/api/v1/public/booking",
        json={
            "first_name": "Member",
            "last_name": "User",
            "phone": "+201000000001",
            "email": "member@example.com",
            "barber_id": employee.id,
            "appointment_date": (date.today() + timedelta(days=1)).isoformat(),
            "appointment_time": "10:00",
            "services": [{"service_id": service.id, "quantity": 1}],
        },
        headers={"Authorization": f"Bearer {registered['token']}"},
    )

    assert response.status_code == 201, response.text
    assert response.json()["customer_id"] == registered["user"]["id"]
    history = client.get(
        "/api/v1/public/member/bookings",
        headers={"Authorization": f"Bearer {registered['token']}"},
    )
    assert history.status_code == 200, history.text
    assert len(history.json()) == 1
