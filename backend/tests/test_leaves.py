from tests.helpers import auth_headers, make_user
from tests.test_payroll_flow import _seed_barber


def test_leave_request_lifecycle(client, db_session):
    make_user(db_session, role="cashier")
    headers = auth_headers(client)
    barber = _seed_barber(db_session)

    created = client.post(
        "/api/v1/barber-presence/leaves",
        json={
            "employee_id": barber.id,
            "type": "vacation",
            "start_date": "2026-10-01",
            "end_date": "2026-10-03",
            "reason": "family trip",
        },
        headers=headers,
    )
    assert created.status_code == 200, created.text
    assert created.json()["status"] == "pending"
    leave_id = created.json()["id"]

    listed = client.get("/api/v1/barber-presence/leaves", headers=headers)
    assert listed.status_code == 200, listed.text
    assert any(l["id"] == leave_id for l in listed.json())

    make_user(db_session, username="owner1", role="owner")
    owner_headers = auth_headers(client, username="owner1")
    approved = client.patch(
        f"/api/v1/barber-presence/leaves/{leave_id}",
        json={"status": "approved"},
        headers=owner_headers,
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"


def test_leave_filter_by_status(client, db_session):
    make_user(db_session, role="cashier")
    headers = auth_headers(client)
    barber = _seed_barber(db_session)

    missing_dates = client.post(
        "/api/v1/barber-presence/leaves",
        json={"employee_id": barber.id, "type": "sick"},
        headers=headers,
    )
    assert missing_dates.status_code == 400

    client.post(
        "/api/v1/barber-presence/leaves",
        json={
            "employee_id": barber.id,
            "type": "sick",
            "start_date": "2026-11-01",
            "end_date": "2026-11-02",
        },
        headers=headers,
    )
    resp = client.get("/api/v1/barber-presence/leaves?status=pending", headers=headers)
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1

    resp = client.get("/api/v1/barber-presence/leaves?status=approved", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_update_missing_leave_404(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.patch(
        "/api/v1/barber-presence/leaves/999999",
        json={"status": "approved"},
        headers=auth_headers(client),
    )
    assert resp.status_code == 404
