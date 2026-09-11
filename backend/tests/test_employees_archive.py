from app.models.employee import Employee
from tests.helpers import auth_headers, make_user


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def _seed(db_session, name, phone, status):
    emp = Employee(
        full_name=name,
        phone_primary=phone,
        job_title="barber",
        status=status,
        is_active=(status == "active"),
    )
    db_session.add(emp)
    db_session.commit()
    db_session.refresh(emp)
    return emp


def test_archive_requires_auth(client):
    resp = client.get("/api/v1/employees/archive")
    assert resp.status_code in (401, 403)


def test_archive_forbidden_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.get("/api/v1/employees/archive", headers=auth_headers(client))
    assert resp.status_code == 403


def test_archive_returns_only_suspended_and_resigned(client, db_session):
    headers = _owner_headers(client, db_session)
    _seed(db_session, "Active One", "01000000001", "active")
    _seed(db_session, "Suspended One", "01000000002", "suspended")
    _seed(db_session, "Resigned One", "01000000003", "resigned")

    resp = client.get("/api/v1/employees/archive", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    statuses = {e["status"] for e in body}
    assert statuses <= {"suspended", "resigned"}
    assert len(body) == 2


def test_archive_status_filter_and_search(client, db_session):
    headers = _owner_headers(client, db_session)
    _seed(db_session, "Suspended One", "01000000002", "suspended")
    _seed(db_session, "Resigned One", "01000000003", "resigned")

    resp = client.get(
        "/api/v1/employees/archive", params={"status": "suspended"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1
    assert resp.json()[0]["status"] == "suspended"

    resp = client.get(
        "/api/v1/employees/archive", params={"q": "Resigned"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1
    assert resp.json()[0]["status"] == "resigned"
