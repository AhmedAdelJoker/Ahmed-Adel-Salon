"""Employee email and contract end date.

Neither had anywhere to live before. `users.email` is the *login* address and is
NULL for staff without an account, which is most of a salon roster, so there was
no field for an employee's own address at all. And a temporary contract had no
end date, so "whose contract is up next month" could only be answered by reading
hire dates and counting months by hand.
"""
from datetime import date

from app.models.employee import Employee
from tests.helpers import auth_headers, make_user


def _owner(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    auth_headers(client, "owner1")
    return auth_headers(client, "owner1")


def test_an_employee_can_be_created_with_an_email_and_contract_end(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json={
            "fullName": "أحمد",
            "phonePrimary": "01001234567",
            "jobTitle": "barber",
            "email": "ahmed@example.com",
            "contractEndDate": "2026-12-31",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["email"] == "ahmed@example.com"
    assert body["contractEndDate"] == "2026-12-31"


def test_the_same_employee_can_have_neither(client, db_session):
    """Permanent staff have no contract end and may have no address."""
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json={"fullName": "سارة", "phonePrimary": "01009876543"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["email"] is None
    assert resp.json()["contractEndDate"] is None


def test_both_can_be_edited_afterwards(client, db_session):
    headers = _owner(client, db_session)
    created = client.post(
        "/api/v1/employees",
        json={"fullName": "أحمد", "phonePrimary": "01001234567"},
        headers=headers,
    ).json()

    resp = client.put(
        f"/api/v1/employees/{created['id']}",
        json={
            "email": "new@example.com",
            "contractEndDate": date(2027, 6, 30).isoformat(),
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == "new@example.com"
    assert resp.json()["contractEndDate"] == "2027-06-30"


def test_an_empty_string_clears_both(client, db_session):
    """The form sends "" for untouched optional fields; that must mean "no value",
    not an empty string stored as if it were an address."""
    headers = _owner(client, db_session)
    created = client.post(
        "/api/v1/employees",
        json={
            "fullName": "أحمد",
            "phonePrimary": "01001234567",
            "email": "ahmed@example.com",
            "contractEndDate": "2026-12-31",
        },
        headers=headers,
    ).json()

    resp = client.put(
        f"/api/v1/employees/{created['id']}",
        json={"email": "", "contractEndDate": ""},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert not body["email"]
    assert not body["contractEndDate"]


def test_a_malformed_email_is_rejected(client, db_session):
    """An address that cannot be delivered to is worse than none: it looks like
    contact info and quietly fails when someone actually tries to use it."""
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json={
            "fullName": "أحمد",
            "phonePrimary": "01001234567",
            "email": "not-an-address",
        },
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


def test_a_contract_cannot_end_before_the_hire_date(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json={
            "fullName": "أحمد",
            "phonePrimary": "01001234567",
            "hireDate": "2026-06-01",
            "contractEndDate": "2026-01-01",
        },
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


def test_the_same_email_may_be_shared_by_two_employees(client, db_session):
    """Shared family and staff addresses are normal; a unique constraint here
    would reject a legitimate roster. The phone guard is the identity check."""
    headers = _owner(client, db_session)
    for name, phone in (("أحمد", "01001234567"), ("سارة", "01009876543")):
        resp = client.post(
            "/api/v1/employees",
            json={
                "fullName": name,
                "phonePrimary": phone,
                "email": "family@example.com",
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text

    db_session.add(
        Employee(
            full_name="legacy",
            phone_primary="01000000009",
            email="family@example.com",
            job_title="barber",
            status="active",
        )
    )
    db_session.commit()


def test_the_email_reaches_the_read_endpoints(client, db_session):
    """Saved but not readable would be the worst outcome: the owner types it,
    approves, and can never confirm it stuck."""
    headers = _owner(client, db_session)
    created = client.post(
        "/api/v1/employees",
        json={
            "fullName": "أحمد",
            "phonePrimary": "01001234567",
            "email": "ahmed@example.com",
        },
        headers=headers,
    ).json()

    detail = client.get(f"/api/v1/employees/{created['id']}", headers=headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["email"] == "ahmed@example.com"