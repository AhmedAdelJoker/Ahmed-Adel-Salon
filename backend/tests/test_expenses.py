from tests.helpers import auth_headers, make_user


def test_list_expenses_requires_auth(client):
    resp = client.get("/api/v1/expenses")
    assert resp.status_code in (401, 403)


def test_list_expenses_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/expenses", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_expense_summary_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/expenses/summary", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
