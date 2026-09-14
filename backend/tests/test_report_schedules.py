from tests.helpers import auth_headers, make_user
from app.models.notification import Notification
from app.services.scheduled_reports import cleanup_old_pdfs
from app.utils.media import get_upload_path

OWNER = {"username": "owner1", "password": "Owner123"}


def _owner_headers(client, db_session):
    make_user(db_session, username=OWNER["username"], password=OWNER["password"], role="owner")
    return auth_headers(client, username=OWNER["username"], password=OWNER["password"])


def test_list_schedules_requires_auth(client):
    resp = client.get("/api/v1/report-schedules")
    assert resp.status_code in (401, 403)


def test_list_schedules_forbidden_for_cashier(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/report-schedules", headers=auth_headers(client))
    assert resp.status_code == 403


def test_crud_schedule(client, db_session):
    headers = _owner_headers(client, db_session)

    resp = client.get("/api/v1/report-schedules", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []

    resp = client.post(
        "/api/v1/report-schedules",
        json={"name": "تقرير يومي", "frequency": "daily", "channel": "notification"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    created = resp.json()
    assert created["frequency"] == "daily"
    assert created["is_active"] is True
    schedule_id = created["id"]

    resp = client.put(
        f"/api/v1/report-schedules/{schedule_id}",
        json={"is_active": False},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is False

    resp = client.delete(f"/api/v1/report-schedules/{schedule_id}", headers=headers)
    assert resp.status_code == 204, resp.text

    resp = client.get("/api/v1/report-schedules", headers=headers)
    assert resp.json() == []


def test_create_schedule_invalid_frequency(client, db_session):
    headers = _owner_headers(client, db_session)
    resp = client.post(
        "/api/v1/report-schedules",
        json={"frequency": "yearly", "channel": "notification"},
        headers=headers,
    )
    assert resp.status_code == 422


def test_run_schedule_now_creates_owner_notification(client, db_session):
    headers = _owner_headers(client, db_session)
    resp = client.post(
        "/api/v1/report-schedules",
        json={"name": "تقرير يومي", "frequency": "daily", "channel": "notification"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    schedule_id = resp.json()["id"]

    resp = client.post(f"/api/v1/report-schedules/{schedule_id}/run-now", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok"
    assert "summary" in body
    assert body["summary"]["revenue"] == 0

    notes = db_session.query(Notification).all()
    assert len(notes) >= 1
    assert "التقرير المالي" in (notes[0].title or "")

    # A PDF summary must be generated and linked
    assert body["pdf_url"] is not None
    assert body["pdf_url"].endswith(".pdf")
    from pathlib import Path
    from app.utils.media import get_upload_path

    pdf_file = get_upload_path("scheduled_reports") / Path(body["pdf_url"]).name
    assert pdf_file.exists()
    assert pdf_file.stat().st_size > 0
    pdf_file.unlink()

    resp = client.get("/api/v1/report-schedules", headers=headers)
    assert resp.json()[0]["last_pdf_url"] == body["pdf_url"]


def test_cleanup_old_pdfs_keeps_recent(tmp_path, monkeypatch):
    from app.utils.media import get_upload_path
    import os

    def fake_get_upload_path(folder):
        return tmp_path / folder

    monkeypatch.setattr("app.services.scheduled_reports.get_upload_path", fake_get_upload_path)
    monkeypatch.setenv("SCHEDULED_PDF_KEEP", "10")

    out_dir = tmp_path / "scheduled_reports"
    out_dir.mkdir(parents=True)
    for i in range(30):
        (out_dir / f"financial_report_daily_202601{i:02d}_000000.pdf").write_text("pdf")

    result = cleanup_old_pdfs(keep_n=10)
    remaining = sorted(out_dir.glob("*.pdf"))
    assert len(remaining) == 10
    assert result["deleted"] == 20
