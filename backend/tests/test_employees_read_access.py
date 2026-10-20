"""GET /employees read vs write gate split (accountant access).

Regression context: the accountant's pages (/attendance, /owner/payroll,
employee reports) render base_salary and call the wide GET /employees, but the
manage-employees gate excluded the accountant — every one of those pages 403'd
on load. Payroll data is the accountant's job domain, so roster READ now admits
them while HR writes stay manager+.
"""
from app.models.employee import Employee
from tests.helpers import auth_headers, make_user


def _headers(client, db_session, username, role):
    make_user(db_session, username=username, role=role)
    return auth_headers(client, username=username)


def _seed(db_session, name, phone):
    emp = Employee(
        full_name=name,
        phone_primary=phone,
        job_title="barber",
        status="active",
        is_active=True,
    )
    db_session.add(emp)
    db_session.commit()
    db_session.refresh(emp)
    return emp


def test_accountant_can_read_roster(client, db_session):
    headers = _headers(client, db_session, "acct1", "accountant")
    _seed(db_session, "Active One", "01000000001")
    resp = client.get("/api/v1/employees", headers=headers)
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1


def test_accountant_cannot_create_employee(client, db_session):
    headers = _headers(client, db_session, "acct1", "accountant")
    resp = client.post(
        "/api/v1/employees",
        json={
            "full_name": "New Hire",
            "phone_primary": "01000000009",
            "job_title": "barber",
        },
        headers=headers,
    )
    assert resp.status_code == 403


def test_cashier_still_forbidden_on_wide_roster(client, db_session):
    headers = _headers(client, db_session, "cashier1", "cashier")
    _seed(db_session, "Active One", "01000000001")
    resp = client.get("/api/v1/employees", headers=headers)
    assert resp.status_code == 403
