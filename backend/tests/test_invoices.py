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

def _seed_three_invoices(client, db_session):
    from tests.test_dashboard import _seed_customer, _seed_invoice

    make_user(db_session)
    customer = _seed_customer(db_session)
    invoices = [
        _seed_invoice(db_session, customer.customer_id, 100, "INV-TEST-1"),
        _seed_invoice(db_session, customer.customer_id, 200, "INV-TEST-2"),
        _seed_invoice(db_session, customer.customer_id, 300, "INV-TEST-3"),
    ]
    return invoices


def test_list_invoices_summary_covers_full_period_not_page(client, db_session):
    _seed_three_invoices(client, db_session)

    resp = client.get(
        "/api/v1/invoices",
        params={"limit": 1},
        headers=auth_headers(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 1
    assert body["summary"] == {
        "count": 3,
        "total": 600.0,
        "average": 200.0,
        "closed": 0,
    }


def test_list_invoices_status_filter_uses_is_closed(client, db_session):
    invoices = _seed_three_invoices(client, db_session)
    invoices[0].is_closed = True
    db_session.commit()

    closed = client.get(
        "/api/v1/invoices",
        params={"status": "closed"},
        headers=auth_headers(client),
    )
    assert closed.status_code == 200, closed.text
    closed_body = closed.json()
    assert closed_body["total"] == 1
    assert closed_body["summary"]["closed"] == 1
    assert closed_body["items"][0]["status"] == "closed"
    assert closed_body["items"][0]["is_closed"] is True

    open_rows = client.get(
        "/api/v1/invoices",
        params={"status": "open"},
        headers=auth_headers(client),
    )
    assert open_rows.status_code == 200, open_rows.text
    assert open_rows.json()["total"] == 2
    assert all(row["status"] == "open" for row in open_rows.json()["items"])


def test_list_invoices_sorts_by_amount(client, db_session):
    _seed_three_invoices(client, db_session)

    asc = client.get(
        "/api/v1/invoices",
        params={"sort": "total_amount", "order": "asc"},
        headers=auth_headers(client),
    )
    assert asc.status_code == 200, asc.text
    assert [row["total_amount"] for row in asc.json()["items"]] == [100.0, 200.0, 300.0]

    desc = client.get(
        "/api/v1/invoices",
        params={"sort": "total_amount", "order": "desc"},
        headers=auth_headers(client),
    )
    assert desc.status_code == 200, desc.text
    assert [row["total_amount"] for row in desc.json()["items"]] == [300.0, 200.0, 100.0]
