from datetime import date, timedelta
from decimal import Decimal

from app.models.employee import Employee
from app.models.service import Service
from app.models.product import Product
from app.models.service_product import ServiceProduct
from app.models.invoice import Invoice
from app.models.cash_transaction import CashTransaction
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


def test_issue_invoice_sets_totals_and_deducts_stock(client, db_session, monkeypatch):
    headers, customer, barber, service = _setup(client, db_session)
    monkeypatch.setattr(
        "app.api.v1.endpoints.appointments.upload_and_send_pdf",
        lambda *args, **kwargs: None,
    )
    product = Product(name="Shampoo", quantity=Decimal("10"), sell_price=Decimal("20"))
    db_session.add(product)
    db_session.flush()
    db_session.add(ServiceProduct(service_id=service.id, product_id=product.id, amount_used=2))
    db_session.commit()
    db_session.refresh(product)

    appointment = client.post(
        "/api/v1/appointments",
        json=_payload(customer.customer_id, barber.id, service.id),
        headers=headers,
    )
    assert appointment.status_code == 201, appointment.text

    issued = client.post(
        f"/api/v1/appointments/{appointment.json()['id']}/issue-invoice",
        params={"payment_method": "cash"},
        headers=headers,
    )
    assert issued.status_code == 201, issued.text

    invoice = db_session.query(Invoice).filter(Invoice.id == issued.json()["invoice_id"]).first()
    assert invoice is not None
    assert float(invoice.subtotal_amount) == 100
    assert float(invoice.total_amount) == 100
    db_session.refresh(product)
    assert float(product.quantity) == 8
    assert (
        db_session.query(CashTransaction)
        .filter(CashTransaction.reference_id == invoice.id)
        .count()
        == 1
    )


def test_create_appointment_requires_auth(client):
    resp = client.post(
        "/api/v1/appointments",
        json=_payload(1, 1, 1),
    )
    assert resp.status_code in (401, 403)


def test_appointment_lookup_and_auto_cancel_require_auth(client):
    conflict = client.get(
        "/api/v1/appointments/check-conflict",
        params={"barber_id": 1, "date": _tomorrow(), "time": "10:00"},
    )
    duplicate = client.get(
        "/api/v1/appointments/check-customer-duplicate",
        params={"customer_id": 1, "date": _tomorrow()},
    )
    auto_cancel = client.post("/api/v1/appointments/auto-cancel-expired")

    assert conflict.status_code in (401, 403)
    assert duplicate.status_code in (401, 403)
    assert auto_cancel.status_code in (401, 403)


def test_walk_in_queue_create_maps_employee_fields(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, username="owner1")
    customer = _seed_customer(db_session, phone="01008887777")
    barber = _seed_barber(db_session)
    service = _seed_service(db_session)

    opened = client.post(
        "/api/v1/pos-shifts/open",
        json={"opening_cash": 0},
        headers=headers,
    )
    assert opened.status_code == 200, opened.text

    response = client.post(
        "/api/v1/walk-in-queue",
        json={
            "customer_id": customer.customer_id,
            "service_id": service.id,
            "requested_barber_id": barber.id,
        },
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["requested_barber_name"] == barber.display_name


def test_public_review_uses_employee_contract(client):
    response = client.post(
        "/api/v1/reviews",
        json={"rating": 5, "comment": "Great service"},
    )

    assert response.status_code == 201, response.text
    assert response.json()["employee_id"] is None
    assert response.json()["barber_id"] is None


def test_waitlist_route_is_mounted_and_protected(client, db_session):
    assert client.get("/api/v1/waitlist").status_code in (401, 403)

    make_user(db_session, username="owner1", role="owner")
    customer = _seed_customer(db_session, phone="01007778888")
    response = client.post(
        "/api/v1/waitlist",
        json={
            "customer_id": customer.customer_id,
            "preferred_date": _tomorrow(),
            "priority": 2,
        },
        headers=auth_headers(client, username="owner1"),
    )

    assert response.status_code == 201, response.text
    assert response.json()["status"] == "waiting"


def test_public_booking_realtime_poll_returns_event(client):
    from app.api.v1.endpoints.booking_public import publish_booking_event

    slug = "realtime-test"
    publish_booking_event(slug, "booking.created", {"bookingId": 42})
    response = client.get(f"/api/v1/public/realtime/booking/{slug}/poll")

    assert response.status_code == 200, response.text
    assert response.json()["event"]["type"] == "booking.created"
    assert response.json()["event"]["data"]["bookingId"] == 42
