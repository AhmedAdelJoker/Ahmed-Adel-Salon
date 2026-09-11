from tests.helpers import auth_headers, make_user
from tests.test_appointments import _seed_barber, _seed_service
from tests.test_dashboard import _seed_customer


def test_fast_walkin_creates_customer_and_booking(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)
    barber = _seed_barber(db_session)
    service = _seed_service(db_session)

    resp = client.post(
        "/api/v1/appointments/fast-walkin",
        json={
            "first_name": "Walk",
            "phone": "01008009000",
            "barber_id": barber.id,
            "service_ids": [service.id],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["customer_id"]
    assert body["barber_id"] == barber.id


def test_fast_walkin_reuses_existing_customer(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)
    customer = _seed_customer(db_session, first_name="Known", phone="01007006000")
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/appointments/fast-walkin",
        json={"phone": "01007006000", "barber_id": barber.id},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["customer_id"] == customer.customer_id


def test_fast_walkin_requires_name_or_phone(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/appointments/fast-walkin",
        json={"barber_id": 1},
        headers=auth_headers(client),
    )
    assert resp.status_code == 422
