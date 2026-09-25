from app.models.employee import Employee
from app.models.expense import Expense
from tests.helpers import auth_headers, make_user


def test_list_payroll_requires_auth(client):
    resp = client.get("/api/v1/payroll")
    assert resp.status_code in (401, 403)


def test_list_payroll_forbidden_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.get("/api/v1/payroll", headers=auth_headers(client))
    assert resp.status_code == 403


def test_list_payroll_empty_for_owner(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, username="owner1")
    resp = client.get("/api/v1/payroll", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_create_salary_advance_creates_linked_expense(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, username="owner1")
    employee = Employee(
        full_name="Advance Employee",
        phone_primary="01005554444",
        job_title="barber",
    )
    db_session.add(employee)
    db_session.commit()
    db_session.refresh(employee)

    response = client.post(
        "/api/v1/salary-advances",
        json={"employee_id": employee.id, "amount": "250"},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    advance_id = response.json()["id"]
    expense = (
        db_session.query(Expense)
        .filter(
            Expense.reference_type == "salary_advance",
            Expense.reference_id == advance_id,
        )
        .one()
    )
    assert expense.amount == 250
