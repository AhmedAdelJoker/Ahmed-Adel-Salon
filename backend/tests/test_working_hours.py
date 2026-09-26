"""Working-hours protocol: validation, day keys, midnight crossing, permissions."""
from datetime import date, datetime, timedelta

import pytest

from app.core.working_hours import (
    DAY_KEYS,
    WorkingHoursError,
    closing_datetime,
    crosses_midnight,
    day_key,
    is_open_at,
    normalize_working_hours,
    opening_datetime,
    resolve_window,
    summarize,
    validate_working_hours,
    window_contains,
    window_minutes,
)
from app.schemas.business_settings import BusinessSettingsUpdate
from app.services.scheduling_service import get_available_time_slots
from tests.helpers import auth_headers, make_user


# --------------------------------------------------------------------------- day keys


def test_day_key_is_locale_independent():
    assert day_key(date(2026, 9, 26)) == "saturday"
    assert day_key(date(2026, 9, 27)) == "sunday"
    assert day_key(date(2026, 9, 28)) == "monday"
    assert day_key(date(2026, 10, 1)) == "thursday"
    assert day_key(date(2026, 10, 2)) == "friday"
    assert day_key(datetime(2026, 9, 26, 23, 59)) == "saturday"


def test_day_key_covers_a_full_week_without_gaps():
    seen = {day_key(date(2026, 9, 21) + timedelta(days=i)) for i in range(7)}
    assert seen == set(DAY_KEYS)


# --------------------------------------------------------------------------- validation


def test_validate_accepts_a_normal_week():
    payload = {d: {"is_open": True, "open_time": "10:00", "close_time": "22:00"} for d in DAY_KEYS}
    validated = validate_working_hours(payload)
    assert set(validated) == set(DAY_KEYS)
    assert validated["friday"]["open_time"] == "10:00"


def test_validate_accepts_overnight_window():
    validated = validate_working_hours(
        {"saturday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"}}
    )
    assert validated["saturday"] == {
        "is_open": True,
        "open_time": "22:00",
        "close_time": "02:00",
    }
    assert crosses_midnight(validated["saturday"]) is True
    assert window_minutes(validated["saturday"]) == 240


def test_validate_rejects_unknown_day_key():
    with pytest.raises(WorkingHoursError) as exc:
        validate_working_hours(
            {"funday": {"is_open": True, "open_time": "10:00", "close_time": "12:00"}}
        )
    assert "funday" in str(exc.value)


@pytest.mark.parametrize(
    "open_time, close_time",
    [("25:99", "12:00"), ("10:00", "99:99"), ("9:00", "12:00"), ("10:00", "10:0"), ("", "12:00")],
)
def test_validate_rejects_malformed_times(open_time, close_time):
    with pytest.raises(WorkingHoursError):
        validate_working_hours(
            {"monday": {"is_open": True, "open_time": open_time, "close_time": close_time}}
        )


def test_validate_rejects_equal_open_and_close():
    with pytest.raises(WorkingHoursError):
        validate_working_hours(
            {"monday": {"is_open": True, "open_time": "10:00", "close_time": "10:00"}}
        )


def test_validate_rejects_window_shorter_than_thirty_minutes():
    with pytest.raises(WorkingHoursError) as exc:
        validate_working_hours(
            {"monday": {"is_open": True, "open_time": "10:00", "close_time": "10:10"}}
        )
    assert "30" in str(exc.value)


def test_validate_rejects_non_mapping_payload():
    with pytest.raises(WorkingHoursError):
        validate_working_hours("not-a-dict")


def test_validate_nulls_out_times_for_closed_days():
    validated = validate_working_hours(
        {"friday": {"is_open": False, "open_time": "10:00", "close_time": "22:00"}}
    )
    assert validated["friday"] == {"is_open": False, "open_time": None, "close_time": None}


def test_validate_is_idempotent():
    payload = {"monday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"}}
    once = validate_working_hours(payload)
    assert validate_working_hours(once) == once


def test_validate_normalizes_unpadded_input_shape():
    with pytest.raises(WorkingHoursError):
        validate_working_hours(
            {"monday": {"is_open": True, "open_time": "9:5", "close_time": "22:00"}}
        )


# --------------------------------------------------------------------------- normalization


def test_normalize_never_raises_on_garbage():
    garbage = {
        "monday": "junk",
        "tuesday": {"is_open": "yes", "open_time": "10:00", "close_time": "12:00"},
        "wednesday": {"is_open": True, "open_time": "99:99", "close_time": "12:00"},
    }
    result = normalize_working_hours(garbage)
    assert set(result) == set(DAY_KEYS)
    assert result["monday"]["is_open"] is False
    assert result["tuesday"]["is_open"] is True
    assert result["wednesday"]["is_open"] is False


def test_normalize_defaults_missing_days_to_closed():
    result = normalize_working_hours(None)
    assert all(result[d]["is_open"] is False for d in DAY_KEYS)


# --------------------------------------------------------------------------- window maths


def test_closing_datetime_rolls_to_next_day_for_overnight():
    saturday = date(2026, 9, 26)
    config = {"is_open": True, "open_time": "22:00", "close_time": "02:00"}
    assert opening_datetime(saturday, config) == datetime(2026, 9, 26, 22, 0)
    assert closing_datetime(saturday, config) == datetime(2026, 9, 27, 2, 0)


def test_closing_datetime_stays_same_day_for_normal_window():
    monday = date(2026, 9, 28)
    config = {"is_open": True, "open_time": "10:00", "close_time": "22:00"}
    assert closing_datetime(monday, config) == datetime(2026, 9, 28, 22, 0)


def test_resolve_window_carries_overnight_into_the_next_day():
    hours = validate_working_hours(
        {"saturday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"}}
    )
    sunday = date(2026, 9, 27)
    window = resolve_window(hours, sunday)
    assert window is not None
    _cfg, opens, closes = window
    assert opens == datetime(2026, 9, 26, 22, 0)
    assert closes == datetime(2026, 9, 27, 2, 0)
    assert window_contains(datetime(2026, 9, 27, 1, 0), _cfg) is True
    assert window_contains(datetime(2026, 9, 27, 2, 30), _cfg) is False


def test_resolve_window_returns_none_on_a_closed_day():
    hours = validate_working_hours(
        {"saturday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"}}
    )
    assert resolve_window(hours, date(2026, 9, 25)) is None


def test_resolve_window_finds_slots_after_midnight():
    saturday = date(2026, 9, 26)
    hours = validate_working_hours(
        {"saturday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"}}
    )
    window = resolve_window(hours, saturday)
    assert window is not None
    _cfg, opens, closes = window
    assert window_contains(datetime(2026, 9, 26, 23, 30), _cfg) is True
    assert closes > opens


def test_is_open_at_respects_the_is_open_flag():
    closed = {"is_open": False, "open_time": None, "close_time": None}
    assert is_open_at(datetime(2026, 9, 26, 12, 0), closed) is False
    open_cfg = {"is_open": True, "open_time": "10:00", "close_time": "14:00"}
    assert is_open_at(datetime(2026, 9, 26, 12, 0), open_cfg) is True
    assert is_open_at(datetime(2026, 9, 26, 15, 0), open_cfg) is False


def test_summarize_counts_overnight_days():
    hours = validate_working_hours(
        {
            "saturday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"},
            "friday": {"is_open": False, "open_time": None, "close_time": None},
        }
    )
    summary = summarize(hours)
    assert summary["open_days"] == 1
    assert summary["closed_days"] == 6
    assert summary["total_minutes"] == 240
    assert summary["overnight_days"] == ["saturday"]


# --------------------------------------------------------------------------- schema wiring


def test_schema_rejects_malformed_working_hours():
    with pytest.raises(ValueError):
        BusinessSettingsUpdate(
            working_hours={"monday": {"is_open": True, "open_time": "99:99", "close_time": "12:00"}}
        )


def test_schema_accepts_overnight_working_hours():
    schema = BusinessSettingsUpdate(
        working_hours={"monday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"}}
    )
    assert schema.working_hours["monday"]["close_time"] == "02:00"


def test_schema_allows_partial_updates_without_working_hours():
    schema = BusinessSettingsUpdate(salonName="صالون جديد")
    assert schema.working_hours is None
    assert schema.salon_name == "صالون جديد"


# --------------------------------------------------------------------------- API


def test_put_rejects_malformed_working_hours(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    resp = client.put(
        "/api/v1/business-settings",
        json={
            "salonName": "صالون",
            "workingHours": {"monday": {"is_open": True, "open_time": "25:00", "close_time": "12:00"}},
        },
        headers=auth_headers(client, "owner1"),
    )
    assert resp.status_code == 422, resp.text


def test_put_persists_overnight_working_hours(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    resp = client.put(
        "/api/v1/business-settings",
        json={
            "salonName": "صالون",
            "workingHours": {"saturday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"}},
        },
        headers=auth_headers(client, "owner1"),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["workingHours"]["saturday"]["close_time"] == "02:00"


def test_cashier_cannot_write_working_hours(client, db_session):
    make_user(db_session, username="cashier1", role="cashier")
    resp = client.post(
        "/api/v1/barber-presence/working-hours",
        json={"working_hours": {"monday": {"is_open": False, "open_time": None, "close_time": None}}},
        headers=auth_headers(client, "cashier1"),
    )
    assert resp.status_code == 403, resp.text


def test_accountant_cannot_write_working_hours(client, db_session):
    make_user(db_session, username="acc1", password="Accountant123", role="accountant")
    resp = client.post(
        "/api/v1/barber-presence/working-hours",
        json={"working_hours": {}},
        headers=auth_headers(client, "acc1", "Accountant123"),
    )
    assert resp.status_code == 403, resp.text


def test_accountant_cannot_change_hours_through_business_settings(client, db_session):
    """`require_owner_or_manager` admits accountants, so the hours guard is explicit."""
    make_user(db_session, username="acc1", password="Accountant123", role="accountant")
    resp = client.put(
        "/api/v1/business-settings",
        json={"salonName": "صالون", "workingHours": {"monday": {"is_open": False, "open_time": None, "close_time": None}}},
        headers=auth_headers(client, "acc1", "Accountant123"),
    )
    assert resp.status_code == 403, resp.text


def test_accountant_can_still_update_financial_settings(client, db_session):
    make_user(db_session, username="acc1", password="Accountant123", role="accountant")
    resp = client.put(
        "/api/v1/business-settings",
        json={"salonName": "صالون", "monthlyRevenueTarget": 750000},
        headers=auth_headers(client, "acc1", "Accountant123"),
    )
    assert resp.status_code == 200, resp.text


def test_manager_can_write_working_hours_but_not_malformed(client, db_session):
    make_user(db_session, username="mgr1", role="manager")
    bad = client.post(
        "/api/v1/barber-presence/working-hours",
        json={"working_hours": {"monday": {"is_open": True, "open_time": "10:00", "close_time": "10:00"}}},
        headers=auth_headers(client, "mgr1"),
    )
    assert bad.status_code == 422, bad.text

    good = client.post(
        "/api/v1/barber-presence/working-hours",
        json={"working_hours": {"monday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"}}},
        headers=auth_headers(client, "mgr1"),
    )
    assert good.status_code == 200, good.text


def test_staff_can_read_working_hours(client, db_session):
    make_user(db_session, username="cashier1", role="cashier")
    resp = client.get("/api/v1/barber-presence/working-hours", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert set(resp.json()["working_hours"]) == set(DAY_KEYS)


# --------------------------------------------------------------------------- availability


def test_available_slots_survive_a_corrupted_row(client, db_session):
    """A hand-edited bad time must not 500 the availability endpoint."""
    from app.models.business_settings import BusinessSettings

    make_user(db_session, username="cashier1", role="cashier")
    row = BusinessSettings(salon_name="SalonPro", currency="EGP")
    row.working_hours = {"monday": {"is_open": True, "open_time": "not-a-time", "close_time": "22:00"}}
    db_session.add(row)
    db_session.commit()

    barber = make_user(db_session, username="barber1", password="Barber123", role="barber")

    resp = client.get(
        "/api/v1/appointments/available-slots",
        params={"barber_id": barber.id, "date": "2026-09-28"},
        headers=auth_headers(client, "cashier1"),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_available_slots_cover_the_overnight_tail(client, db_session):
    from app.models.business_settings import BusinessSettings

    make_user(db_session, username="cashier1", role="cashier")
    barber = make_user(db_session, username="barber1", password="Barber123", role="barber")

    row = BusinessSettings(salon_name="SalonPro", currency="EGP")
    row.working_hours = {"saturday": {"is_open": True, "open_time": "22:00", "close_time": "02:00"}}
    db_session.add(row)
    db_session.commit()

    resp = client.get(
        "/api/v1/appointments/available-slots",
        params={"barber_id": barber.id, "date": "2026-09-26"},
        headers=auth_headers(client, "cashier1"),
    )
    assert resp.status_code == 200, resp.text
    slots = [s["time"] for s in resp.json()]
    assert "22:00" in slots
    assert "01:30" in slots
    assert "02:00" not in slots


def test_get_available_time_slots_returns_empty_for_closed_day(db_session):
    from app.models.business_settings import BusinessSettings

    row = BusinessSettings(salon_name="SalonPro", currency="EGP")
    row.working_hours = {"saturday": {"is_open": False, "open_time": None, "close_time": None}}
    db_session.add(row)
    db_session.commit()

    assert get_available_time_slots(db_session, 1, date(2026, 9, 26)) == []
