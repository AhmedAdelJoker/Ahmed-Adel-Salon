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
