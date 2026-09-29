"""Concurrency control, audit trail and publish-staleness on business settings."""
from app.models.activity_log import ActivityLog
from app.models.business_settings import BusinessSettings
from tests.helpers import auth_headers, make_user


def _owner(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, "owner1")


def _put(client, headers, payload):
    return client.put("/api/v1/business-settings", json=payload, headers=headers)


def test_read_exposes_a_version(client, db_session):
    headers = _owner(client, db_session)
    body = client.get("/api/v1/business-settings", headers=headers).json()
    assert body["version"] == 1
    assert body["publicSiteStale"] is False


def test_save_bumps_the_version(client, db_session):
    headers = _owner(client, db_session)
    resp = _put(client, headers, {"salonName": "صالون الأناقة"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["version"] == 2
    assert resp.json()["salonName"] == "صالون الأناقة"


def test_etag_header_is_returned(client, db_session):
    headers = _owner(client, db_session)
    resp = _put(client, headers, {"salonName": " محل"})
    assert resp.headers["ETag"] == 'W/"2"'


def test_matching_expected_version_succeeds(client, db_session):
    headers = _owner(client, db_session)
    current = client.get("/api/v1/business-settings", headers=headers).json()["version"]
    resp = _put(client, headers, {"salonName": "س", "expectedVersion": current})
    assert resp.status_code == 200, resp.text


def test_stale_expected_version_is_rejected_with_409(client, db_session):
    """Two owners editing at once: the second save must not clobber the first."""
    headers = _owner(client, db_session)
    first = _put(client, headers, {"salonName": "من المالك الأول"})
    assert first.status_code == 200

    stale = _put(client, headers, {"salonName": "من المالك الثاني", "expectedVersion": 1})
    assert stale.status_code == 409, stale.text
    assert "مستخدم آخر" in stale.json()["detail"]


def test_rejected_save_does_not_mutate_the_row(client, db_session):
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "الأول"})
    _put(client, headers, {"salonName": "الثاني", "expectedVersion": 1})

    final = client.get("/api/v1/business-settings", headers=headers).json()
    assert final["salonName"] == "الأول"
    assert final["version"] == 2


def test_omitting_expected_version_still_saves(client, db_session):
    """Backwards compatibility: clients that do not send the field are not blocked."""
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "أ"})
    resp = _put(client, headers, {"salonName": "ب"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["salonName"] == "ب"


def test_working_hours_save_honours_the_version_guard(client, db_session):
    headers = _owner(client, db_session)
    _put(client, headers, {
        "workingHours": {"monday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"}}
    })
    stale = _put(client, headers, {
        "workingHours": {"monday": {"is_open": True, "open_time": "12:00", "close_time": "23:00"}},
        "expectedVersion": 1,
    })
    assert stale.status_code == 409, stale.text


def test_empty_payload_does_not_bump_the_version(client, db_session):
    headers = _owner(client, db_session)
    resp = _put(client, headers, {})
    assert resp.status_code == 200
    assert resp.json()["version"] == 1


# --------------------------------------------------------------------------- audit trail


def test_settings_update_writes_an_audit_entry(client, db_session):
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "salon name"})

    entries = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.action == "UPDATE_BUSINESS_SETTINGS")
        .all()
    )
    assert len(entries) == 1
    description = entries[0].description
    assert "اسم المنشأة" in description
    assert "الإصدار 2" in description


def test_working_hours_save_logs_its_own_action(client, db_session):
    """Hours changes get a distinct action so they can be audited separately."""
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "salon name"})

    generic = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.action == "UPDATE_BUSINESS_SETTINGS")
        .all()
    )
    assert len(generic) == 1
    assert "ساعات العمل" not in generic[0].description

    _put(client, headers, {
        "workingHours": {"monday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"}}
    })

    hours_entries = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.action == "UPDATE_WORKING_HOURS")
        .all()
    )
    assert len(hours_entries) == 1
    assert "ساعات العمل" in hours_entries[0].description


def test_presence_endpoint_logs_a_per_day_hours_diff(client, db_session):
    make_user(db_session, username="mgr1", role="manager")
    # first write: everything open
    first = client.post(
        "/api/v1/barber-presence/working-hours",
        json={"working_hours": {
            "monday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
            "friday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
        }},
        headers=auth_headers(client, "mgr1"),
    )
    assert first.status_code == 200, first.text

    # second write: friday closes and monday shifts
    resp = client.post(
        "/api/v1/barber-presence/working-hours",
        json={"working_hours": {
            "friday": {"is_open": False, "open_time": None, "close_time": None},
            "monday": {"is_open": True, "open_time": "12:00", "close_time": "20:00"},
        }},
        headers=auth_headers(client, "mgr1"),
    )
    assert resp.status_code == 200, resp.text

    entry = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.action == "UPDATE_WORKING_HOURS")
        .order_by(ActivityLog.id.desc())
        .first()
    )
    assert entry is not None
    assert "الجمعة: مغلق" in entry.description
    assert "الاثنين" in entry.description
    assert "12:00" in entry.description


def test_audit_entry_records_the_actor(client, db_session):
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "x"})

    entry = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.action == "UPDATE_BUSINESS_SETTINGS")
        .first()
    )
    assert entry.user_id is not None
    assert entry.entity_type == "BusinessSettings"


def test_no_audit_entry_when_nothing_changed(client, db_session):
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "unchanged"})

    again = _put(client, headers, {"salonName": "unchanged"})
    assert again.status_code == 200
    # still only the first write produced a diff worth logging
    count = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.action == "UPDATE_BUSINESS_SETTINGS")
        .count()
    )
    assert count == 1


def test_publish_writes_an_audit_entry(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post("/api/v1/business-settings/publish-site", headers=headers)
    assert resp.status_code == 200, resp.text

    entry = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.action == "PUBLISH_PUBLIC_SITE")
        .first()
    )
    assert entry is not None


# --------------------------------------------------------------------------- publish staleness


def test_publish_stamps_the_published_version(client, db_session):
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "before publish"})
    published = client.post("/api/v1/business-settings/publish-site", headers=headers).json()

    assert published["publicSitePublishedVersion"] == published["version"]
    assert published["publicSiteStale"] is False


def test_editing_after_publish_marks_the_site_stale(client, db_session):
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "v1"})
    client.post("/api/v1/business-settings/publish-site", headers=headers)

    _put(client, headers, {
        "workingHours": {"monday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"}}
    })
    after = client.get("/api/v1/business-settings", headers=headers).json()

    assert after["publicSiteStale"] is True
    assert after["publicSitePublishedVersion"] < after["version"]


def test_republishing_clears_the_stale_flag(client, db_session):
    headers = _owner(client, db_session)
    _put(client, headers, {"salonName": "v1"})
    client.post("/api/v1/business-settings/publish-site", headers=headers)
    _put(client, headers, {"salonName": "v2"})

    republished = client.post("/api/v1/business-settings/publish-site", headers=headers).json()
    assert republished["publicSiteStale"] is False


def test_snapshot_captures_working_hours(client, db_session):
    headers = _owner(client, db_session)
    hours = {"monday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"}}
    _put(client, headers, {"workingHours": hours})
    client.post("/api/v1/business-settings/publish-site", headers=headers)

    row = db_session.query(BusinessSettings).first()
    assert row.public_site_snapshot["working_hours"] == hours
