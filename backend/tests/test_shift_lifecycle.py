from tests.helpers import auth_headers, make_user


def test_shift_open_current_close_roundtrip(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)

    opened = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 500}, headers=headers)
    assert opened.status_code == 200, opened.text
    shift_id = opened.json()["id"]

    current = client.get("/api/v1/pos-shifts/current", headers=headers)
    assert current.status_code == 200, current.text
    assert current.json()["id"] == shift_id

    closed = client.post(
        f"/api/v1/pos-shifts/{shift_id}/close",
        json={"countedCash": 500},
        headers=headers,
    )
    assert closed.status_code == 200, closed.text
    body = closed.json()
    assert body["shift"]["status"] == "closed"
    assert body["stats"]["cash_sales"] == 0
    assert body["shift"]["expected_closing_cash"] == 500

    current_after = client.get("/api/v1/pos-shifts/current", headers=headers)
    assert current_after.status_code == 200, current_after.text
    assert current_after.json() is None


def test_shift_double_open_rejected(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)

    first = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 100}, headers=headers)
    assert first.status_code == 200, first.text

    second = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 100}, headers=headers)
    assert second.status_code == 400


def test_shift_double_close_rejected(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)

    opened = client.post("/api/v1/pos-shifts/open", json={"opening_cash": 100}, headers=headers)
    shift_id = opened.json()["id"]

    first_close = client.post(
        f"/api/v1/pos-shifts/{shift_id}/close", json={"countedCash": 100}, headers=headers
    )
    assert first_close.status_code == 200, first_close.text

    second_close = client.post(
        f"/api/v1/pos-shifts/{shift_id}/close", json={"countedCash": 100}, headers=headers
    )
    assert second_close.status_code == 400


def test_close_missing_shift_returns_404(client, db_session):
    make_user(db_session)
    resp = client.post(
        "/api/v1/pos-shifts/999999/close", json={"countedCash": 0}, headers=auth_headers(client)
    )
    assert resp.status_code == 404
