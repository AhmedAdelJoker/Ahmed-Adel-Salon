from tests.helpers import auth_headers, make_user


def test_list_invoices_requires_auth(client):
    resp = client.get("/api/v1/invoices")
    assert resp.status_code in (401, 403)


def test_list_invoices_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/invoices", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_get_invoice_not_found(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/invoices/999999", headers=auth_headers(client))
    assert resp.status_code == 404


def test_list_drafts_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/invoices/drafts", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []
