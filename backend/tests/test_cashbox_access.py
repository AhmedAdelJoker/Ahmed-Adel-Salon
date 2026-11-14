"""POST /cashbox/transactions — gate width for till operators.

Regression context: the cashbox page is cashier-reachable and its GETs are
cashier-level, but the manual deposit/withdraw write was owner_or_manager — the
role that physically handles the till could read the box but not record what
they put in or took out (403 on the page's primary action).
"""
from tests.helpers import auth_headers, make_user


def _headers(client, db_session, username, role):
    make_user(db_session, username=username, role=role)
    return auth_headers(client, username=username)


def _payload():
    return {"direction": "in", "amount": 100, "payment_method": "cash"}


def test_cashier_can_record_manual_cash_transaction(client, db_session):
    headers = _headers(client, db_session, "cashier1", "cashier")
    resp = client.post(
        "/api/v1/cashbox/transactions", json=_payload(), headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["direction"] == "in"
    assert float(body["amount"]) == 100


def test_accountant_cannot_create_cash_transaction(client, db_session):
    # Accountant audits the box (route access + reads) but never moves cash,
    # matching require_shift_operator everywhere else money is handled.
    headers = _headers(client, db_session, "acct1", "accountant")
    resp = client.post(
        "/api/v1/cashbox/transactions", json=_payload(), headers=headers
    )
    assert resp.status_code == 403


def test_cash_transaction_requires_auth(client):
    resp = client.post(
        "/api/v1/cashbox/transactions",
        json={"direction": "in", "amount": 100},
    )
    assert resp.status_code in (401, 403)
