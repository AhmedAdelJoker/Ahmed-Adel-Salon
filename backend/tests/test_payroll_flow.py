from datetime import date

from app.models.employee import Employee
from app.models.expense import Expense
from tests.helpers import auth_headers, make_user


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def _seed_barber(db_session, name="Payroll Barber", phone="01006007000"):
    barber = Employee(full_name=name, phone_primary=phone, job_title="barber", is_active=True)
    db_session.add(barber)
    db_session.commit()
    db_session.refresh(barber)
    return barber


def _period():
    today = date.today()
    return {"month": today.month, "year": today.year}


def test_calculate_forbidden_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.post("/api/v1/payroll/calculate", json=_period(), headers=auth_headers(client))
    assert resp.status_code == 403


def test_calculate_creates_records(client, db_session):
    headers = _owner_headers(client, db_session)
    barber = _seed_barber(db_session)

    resp = client.post("/api/v1/payroll/calculate", json=_period(), headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1
    assert body[0]["employeeId"] == barber.id
    assert body[0]["status"] == "calculated"


def test_pay_creates_expense_and_locks_double_pay(client, db_session):
    headers = _owner_headers(client, db_session)
    _seed_barber(db_session)

    calc = client.post("/api/v1/payroll/calculate", json=_period(), headers=headers)
    assert calc.status_code == 200, calc.text
    payroll_id = calc.json()[0]["id"]

    before = db_session.query(Expense).count()
    paid = client.post(f"/api/v1/payroll/{payroll_id}/pay", headers=headers)
    assert paid.status_code == 200, paid.text
    assert paid.json()["status"] == "paid"
    assert db_session.query(Expense).count() == before + 1

    again = client.post(f"/api/v1/payroll/{payroll_id}/pay", headers=headers)
    assert again.status_code == 400


def test_cancel_payroll(client, db_session):
    headers = _owner_headers(client, db_session)
    _seed_barber(db_session)

    calc = client.post("/api/v1/payroll/calculate", json=_period(), headers=headers)
    payroll_id = calc.json()[0]["id"]

    cancelled = client.post(f"/api/v1/payroll/{payroll_id}/cancel", headers=headers)
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"


def test_pay_missing_payroll_404(client, db_session):
    headers = _owner_headers(client, db_session)
    resp = client.post("/api/v1/payroll/999999/pay", headers=headers)
    assert resp.status_code == 404
