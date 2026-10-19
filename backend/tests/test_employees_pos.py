"""GET /employees/pos — slim staff list for the POS terminal.

Regression context: POS fetched the full ``GET /employees`` roster, which is
manage-employees-only because it carries base_salary / commission_rate. Every
cashier got 403 ("لا تملك صلاحية للقيام بهذا الإجراء") and the till rendered
without an expert list. ``/employees/pos`` must load for any staff role while
leaking no payroll fields.
"""
from app.models.employee import Employee
from tests.helpers import auth_headers, make_user

PAYROLL_FIELDS = {"base_salary", "commission_rate", "phone_primary", "wallet_number"}


def _cashier_headers(client, db_session):
    make_user(db_session, username="cashier1", role="cashier")
    return auth_headers(client, username="cashier1")


def _seed(db_session, name, phone, *, status="active", is_active=True, show_in_pos=True):
    emp = Employee(
        full_name=name,
        phone_primary=phone,
        job_title="barber",
        status=status,
        is_active=is_active,
        show_in_pos=show_in_pos,
    )
    db_session.add(emp)
    db_session.commit()
    db_session.refresh(emp)
    return emp


def test_pos_employees_requires_auth(client):
    resp = client.get("/api/v1/employees/pos")
    assert resp.status_code in (401, 403)


def test_pos_employees_allowed_for_cashier(client, db_session):
    # The exact reported failure: cashier on the POS screen got 403.
    headers = _cashier_headers(client, db_session)
    _seed(db_session, "Active One", "01000000001")
    resp = client.get("/api/v1/employees/pos", headers=headers)
    assert resp.status_code == 200, resp.text


def test_pos_employees_allowed_for_barber(client, db_session):
    make_user(db_session, username="barber1", role="barber")
    headers = auth_headers(client, username="barber1")
    resp = client.get("/api/v1/employees/pos", headers=headers)
    assert resp.status_code == 200, resp.text


def test_pos_employees_filters_inactive_and_hidden(client, db_session):
    headers = _cashier_headers(client, db_session)
    _seed(db_session, "Active One", "01000000001")
    _seed(db_session, "Suspended One", "01000000002", status="suspended", is_active=False)
    _seed(db_session, "Resigned One", "01000000003", status="resigned", is_active=False)
    _seed(db_session, "Soft Disabled", "01000000004", is_active=False)
    _seed(db_session, "Hidden From POS", "01000000005", show_in_pos=False)

    resp = client.get("/api/v1/employees/pos", headers=headers)
    assert resp.status_code == 200, resp.text
    names = {e["full_name"] for e in resp.json()}
    assert names == {"Active One"}


def test_pos_employees_payload_has_no_payroll_fields(client, db_session):
    headers = _cashier_headers(client, db_session)
    _seed(db_session, "Active One", "01000000001")
    resp = client.get("/api/v1/employees/pos", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1
    row = body[0]
    for field in PAYROLL_FIELDS:
        assert field not in row
    for field in ("id", "full_name", "job_title", "service_ids"):
        assert field in row


def test_full_roster_stays_forbidden_for_cashier(client, db_session):
    # The payroll-bearing list must keep its manage-employees gate.
    headers = _cashier_headers(client, db_session)
    _seed(db_session, "Active One", "01000000001")
    resp = client.get("/api/v1/employees", headers=headers)
    assert resp.status_code == 403


def test_active_employees_requires_auth(client):
    resp = client.get("/api/v1/employees/active")
    assert resp.status_code in (401, 403)


def test_active_employees_allowed_for_cashier_and_lists_hidden_from_pos(
    client, db_session
):
    # The bookings board is an internal assignment surface: staff switched off
    # for the POS/online-booking toggles must still be assignable as walk-in
    # experts, so only inactivity filters here — never the visibility flags.
    headers = _cashier_headers(client, db_session)
    _seed(db_session, "Active One", "01000000001")
    _seed(db_session, "Hidden From POS", "01000000002", show_in_pos=False)
    _seed(
        db_session, "Suspended One", "01000000003", status="suspended", is_active=False
    )
    _seed(
        db_session, "Resigned One", "01000000004", status="resigned", is_active=False
    )

    resp = client.get("/api/v1/employees/active", headers=headers)
    assert resp.status_code == 200, resp.text
    names = {e["full_name"] for e in resp.json()}
    assert names == {"Active One", "Hidden From POS"}


def test_active_employees_payload_has_no_payroll_fields(client, db_session):
    headers = _cashier_headers(client, db_session)
    _seed(db_session, "Active One", "01000000001")
    resp = client.get("/api/v1/employees/active", headers=headers)
    assert resp.status_code == 200, resp.text
    for row in resp.json():
        for field in PAYROLL_FIELDS:
            assert field not in row
