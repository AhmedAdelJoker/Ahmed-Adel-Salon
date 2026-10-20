"""The online-booking switch is owner intent *within* a classification.

Only service providers — barber, colorist, esthetician — can ever have
`show_in_booking` on. The server forces it off for every other job title on
both create and update, so a mis-clicked toggle, a direct API call, or a role
change that turns a barber into an accountant cannot leak staff to the public
site. `/time-slots` enforces the same predicate, so a stale `barber_id` link
cannot resurrect a hidden employee either.
"""
from datetime import date

from app.models.employee import Employee
from tests.helpers import auth_headers, make_user


def _owner(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    auth_headers(client, "owner1")
    return auth_headers(client, "owner1")


def _payload(**overrides):
    data = {"fullName": "أحمد محمد علي", "phonePrimary": "01001234567"}
    data.update(overrides)
    return data


def _stored(db_session, employee_id):
    return db_session.query(Employee).filter(Employee.id == employee_id).first()


def test_create_forces_the_switch_off_for_an_accountant(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(jobTitle="accountant", showInBooking=True),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert not _stored(db_session, resp.json()["id"]).show_in_booking


def test_create_keeps_the_switch_for_a_service_provider(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(jobTitle="colorist", showInBooking=True),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert _stored(db_session, resp.json()["id"]).show_in_booking


def test_changing_a_barber_into_an_accountant_turns_the_switch_off(client, db_session):
    """A role change is also a classification change — the stored True must not
    survive it."""
    headers = _owner(client, db_session)
    created = client.post(
        "/api/v1/employees",
        json=_payload(jobTitle="barber", showInBooking=True),
        headers=headers,
    )
    assert created.status_code == 201, created.text
    employee_id = created.json()["id"]

    resp = client.put(
        f"/api/v1/employees/{employee_id}",
        json={"jobTitle": "accountant"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert not _stored(db_session, employee_id).show_in_booking


def test_update_cannot_re_enable_the_switch_for_admin_staff(client, db_session):
    headers = _owner(client, db_session)
    created = client.post(
        "/api/v1/employees",
        json=_payload(jobTitle="cashier", showInBooking=False),
        headers=headers,
    )
    assert created.status_code == 201, created.text
    employee_id = created.json()["id"]

    resp = client.put(
        f"/api/v1/employees/{employee_id}",
        json={"showInBooking": True},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert not _stored(db_session, employee_id).show_in_booking


def test_time_slots_refuses_a_barber_on_vacation(client, db_session):
    headers = _owner(client, db_session)
    created = client.post(
        "/api/v1/employees",
        json=_payload(jobTitle="barber"),
        headers=headers,
    )
    assert created.status_code == 201, created.text
    employee_id = created.json()["id"]

    row = _stored(db_session, employee_id)
    row.status = "suspended"  # في إجازة
    db_session.commit()

    resp = client.get(
        "/api/v1/public/time-slots",
        params={"barber_id": employee_id, "booking_date": date.today().isoformat()},
    )
    assert resp.status_code == 404, resp.text


def test_time_slots_serves_a_bookable_barber(client, db_session):
    headers = _owner(client, db_session)
    created = client.post(
        "/api/v1/employees",
        json=_payload(jobTitle="barber"),
        headers=headers,
    )
    assert created.status_code == 201, created.text
    employee_id = created.json()["id"]

    resp = client.get(
        "/api/v1/public/time-slots",
        params={"barber_id": employee_id, "booking_date": date.today().isoformat()},
    )
    assert resp.status_code == 200, resp.text
    assert "available_slots" in resp.json()
