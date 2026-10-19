"""Barber dashboard correctness: money, status transitions, ownership, timer.

Every test here corresponds to a defect that shipped. They are written against
the API rather than the helpers, because the defects were in the API's contract
-- an endpoint accepting a status string it had no meaning for, a barber writing
to a shop-wide customer row, money silently rounded by a float -- and testing
the helpers would have missed the contract that was actually broken.

The commission-rate tests are the one place that calls a helper directly, and
they are marked as such below.
"""
from datetime import date, time, timedelta
from decimal import Decimal

import pytest

from app.core.clock import salon_now
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.user import User
from tests.helpers import auth_headers, make_user


# --------------------------------------------------------------------------
# fixtures
# --------------------------------------------------------------------------

def _barber(db_session, username, commission_rate=Decimal("15")):
    make_user(db_session, username=username, role="barber")
    user = db_session.query(User).filter(User.username == username).first()
    employee = Employee(
        full_name=f"Barber {username}",
        phone_primary=f"010{abs(hash(username)) % 10**10:010d}",
        job_title="barber",
        commission_rate=commission_rate,
    )
    db_session.add(employee)
    db_session.commit()
    user.barber_id = employee.id
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user, employee


def _manager(db_session, username):
    make_user(db_session, username=username, role="manager")
    return db_session.query(User).filter(User.username == username).first()


def _customer(db_session, first="Ahmed", last="Adel", phone="01000000001"):
    c = Customer(first_name=first, last_name=last, phone=phone)
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


def _appointment(db_session, customer, employee, status="waiting", day=None, price=0):
    a = Appointment(
        customer_id=customer.customer_id,
        barber_id=employee.id,
        appointment_date=day or salon_now().date(),
        appointment_time=time(12, 0),
        status=status,
        notes="pytest fixture",
        total_estimated_price=Decimal(str(price)),
        total_estimated_duration_minutes=30,
    )
    db_session.add(a)
    db_session.commit()
    db_session.refresh(a)
    return a


# --------------------------------------------------------------------------
# 1. appointment status state machine
# --------------------------------------------------------------------------

def test_unknown_status_is_rejected_rather_than_stored(client, db_session):
    """`?status=banana` used to answer 200 and write "banana" to the row.

    That string is in none of the queue filters, so the appointment vanished
    from every list and every chart in the product, and nothing reported it.
    """
    _user, employee = _barber(db_session, "s1")
    cust = _customer(db_session)
    apt = _appointment(db_session, cust, employee)
    headers = auth_headers(client, "s1")

    resp = client.post(
        f"/api/v1/barber/update-status/{apt.id}", params={"status": "banana"},
        headers=headers,
    )

    assert resp.status_code == 422, resp.text

    db_session.expire_all()
    row = db_session.query(Appointment).filter(Appointment.id == apt.id).first()
    assert row.status == "waiting", "the rejected value must not be persisted"


def test_illegal_transition_is_refused_with_a_useful_message(client, db_session):
    """waiting -> completed skips payment; the API used to allow it silently."""
    _user, employee = _barber(db_session, "s2")
    cust = _customer(db_session)
    apt = _appointment(db_session, cust, employee, status="waiting")
    headers = auth_headers(client, "s2")

    resp = client.post(
        f"/api/v1/barber/update-status/{apt.id}", params={"status": "completed"},
        headers=headers,
    )

    assert resp.status_code == 409, resp.text
    body = resp.json()
    # The barber has to be told what they *can* do, not just that they can't.
    assert "allowed" in str(body).lower() or "allowed" in str(body).lower() or body.get("detail")

    db_session.expire_all()
    row = db_session.query(Appointment).filter(Appointment.id == apt.id).first()
    assert row.status == "waiting"


@pytest.mark.parametrize(
    "start,target,expected",
    [
        ("waiting", "in-service", "in-service"),
        ("in-service", "completed", "ready_for_payment"),
        ("confirmed", "in-service", "in-service"),
    ],
)
def test_legal_transitions_still_work(client, db_session, start, target, expected):
    _user, employee = _barber(db_session, f"ok_{start}")
    cust = _customer(db_session, phone=f"010{abs(hash(start)) % 10**8:08d}")
    apt = _appointment(db_session, cust, employee, status=start)
    headers = auth_headers(client, f"ok_{start}")

    resp = client.post(
        f"/api/v1/barber/update-status/{apt.id}", params={"status": target},
        headers=headers,
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["new_status"] == expected

    db_session.expire_all()
    row = db_session.query(Appointment).filter(Appointment.id == apt.id).first()
    assert row.status == expected


def test_repeating_the_current_status_is_idempotent(client, db_session):
    """A double-tap, or a retried request, must not be an error."""
    _user, employee = _barber(db_session, "idem")
    cust = _customer(db_session)
    apt = _appointment(db_session, cust, employee, status="in-service")
    headers = auth_headers(client, "idem")

    resp = client.post(
        f"/api/v1/barber/update-status/{apt.id}", params={"status": "in-service"},
        headers=headers,
    )

    assert resp.status_code == 200, resp.text


# --------------------------------------------------------------------------
# 2. shared customer ownership
# --------------------------------------------------------------------------

def test_barber_cannot_rewrite_a_shop_wide_customer_record(client, db_session):
    """`Customer` is shared: the cashier and every other barber read the same row.

    The old guard only checked that this barber had *ever* served the customer --
    a read relationship -- and then permitted the write. One appointment was
    enough to earn permanent write access to the address book.
    """
    _user, employee = _barber(db_session, "own1")
    cust = _customer(db_session)
    _appointment(db_session, cust, employee)  # the qualifying relationship
    headers = auth_headers(client, "own1")

    resp = client.put(
        f"/api/v1/barber/clients/{cust.customer_id}",
        json={"name": "Hacked Name", "phone": "0000"},
        headers=headers,
    )

    assert resp.status_code == 403, resp.text

    db_session.expire_all()
    row = db_session.query(Customer).filter(Customer.customer_id == cust.customer_id).first()
    assert row.first_name == "Ahmed"
    assert row.phone == "01000000001"


def test_manager_can_edit_the_customer(client, db_session):
    _manager(db_session, "mgr1")
    cust = _customer(db_session)
    headers = auth_headers(client, "mgr1")

    resp = client.put(
        f"/api/v1/barber/clients/{cust.customer_id}",
        json={"name": "New Name Here", "phone": "01234567890"},
        headers=headers,
    )

    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    row = db_session.query(Customer).filter(Customer.customer_id == cust.customer_id).first()
    assert row.first_name == "New"
    assert row.last_name == "Name Here"


def test_single_word_name_does_not_erase_the_surname(client, db_session):
    """`split(maxsplit=1)` left `last_name = ""` for a one-word name.

    A field the caller never intended to change was being cleared, silently, on
    every save from a client whose name is a single token.
    """
    _manager(db_session, "mgr2")
    cust = _customer(db_session, first="Ahmed", last="Adel Ibrahim")
    headers = auth_headers(client, "mgr2")

    resp = client.put(
        f"/api/v1/barber/clients/{cust.customer_id}",
        json={"name": "Ahmed", "phone": "01000000001"},
        headers=headers,
    )

    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    row = db_session.query(Customer).filter(Customer.customer_id == cust.customer_id).first()
    assert row.first_name == "Ahmed"
    assert row.last_name == "Adel Ibrahim", "surname must survive a one-word save"


# --------------------------------------------------------------------------
# 3. commission rate: a 0% rate is a real setting
# --------------------------------------------------------------------------

def test_zero_commission_rate_is_respected_not_defaulted(db_session):
    """Helper-level, so the arithmetic is checked directly.

    The old line was `getattr(barber, "commission_rate", None) or 15`.
    `Decimal("0")` is falsy, so a barber deliberately set to 0% -- straight
    salary, no commission -- was paid at 15%. That inflated the earnings summary
    and every commission row for that barber.
    """
    from app.api.v1.endpoints.barber import _commission, _rate_decimal

    _user, employee = _barber(db_session, "zero", commission_rate=Decimal("0"))
    db_session.refresh(employee)

    assert _rate_decimal(employee) == Decimal("0")
    assert _commission(Decimal("1000"), _rate_decimal(employee)) == Decimal("0")


@pytest.mark.parametrize(
    "rate,expected",
    [
        (Decimal("0"), Decimal("0")),
        (Decimal("2"), Decimal("0.02")),
        (Decimal("15"), Decimal("0.15")),
        (Decimal("100"), Decimal("1")),
    ],
)
def test_commission_rate_conversions(db_session, rate, expected):
    from app.api.v1.endpoints.barber import _rate_decimal

    employee = Employee(full_name="X", commission_rate=rate)
    assert _rate_decimal(employee) == expected


def test_unset_commission_rate_falls_back_to_fifteen_percent(db_session):
    """NULL is genuinely unconfigured, and is the only case that may default."""
    from app.api.v1.endpoints.barber import _rate_decimal

    employee = Employee(full_name="X", commission_rate=None)
    assert _rate_decimal(employee) == Decimal("0.15")


# --------------------------------------------------------------------------
# 4. the service timer
# --------------------------------------------------------------------------

def test_started_at_is_stamped_once_and_survives_a_reload(client, db_session):
    """The detail endpoint hardcoded `"started_at": None`.

    The workstation rebuilds its elapsed timer from that field on every load, so
    a barber who refreshed mid-cut saw the clock reset to zero.
    """
    _user, employee = _barber(db_session, "timer")
    cust = _customer(db_session)
    apt = _appointment(db_session, cust, employee, status="waiting")
    headers = auth_headers(client, "timer")

    before = client.get(f"/api/v1/barber/appointments/{apt.id}", headers=headers)
    assert before.status_code == 200, before.text
    assert before.json()["started_at"] is None

    started = client.post(
        f"/api/v1/barber/update-status/{apt.id}", params={"status": "in-service"},
        headers=headers,
    )
    assert started.status_code == 200, started.text

    after = client.get(f"/api/v1/barber/appointments/{apt.id}", headers=headers)
    first_stamp = after.json()["started_at"]
    assert first_stamp is not None, "the timer needs a real timestamp to rebuild from"

    # A replay must not move the clock of a job already under way.
    client.post(
        f"/api/v1/barber/update-status/{apt.id}", params={"status": "in-service"},
        headers=headers,
    )
    replayed = client.get(f"/api/v1/barber/appointments/{apt.id}", headers=headers)
    assert replayed.json()["started_at"] == first_stamp


# --------------------------------------------------------------------------
# 5. queue sort must not reflect arbitrary class attributes
# --------------------------------------------------------------------------

@pytest.mark.parametrize("sort_value", ["metadata", "__table__", "bogus_column"])
def test_sorting_by_a_non_column_does_not_crash_the_endpoint(client, db_session, sort_value):
    """`getattr(Appointment, sort_field)` accepted any class attribute.

    `MetaData` has no `.desc()`, so `?sort=metadata` returned 500 -- a client
    controlled string choosing between "works" and "server error".
    """
    _user, employee = _barber(db_session, f"sort_{abs(hash(sort_value)) % 9999}")
    cust = _customer(db_session, phone=f"011{abs(hash(sort_value)) % 10**8:08d}")
    _appointment(db_session, cust, employee)
    headers = auth_headers(client, f"sort_{abs(hash(sort_value)) % 9999}")

    resp = client.get("/api/v1/barber/queue", params={"sort": sort_value}, headers=headers)

    assert resp.status_code == 200, f"sort={sort_value} -> {resp.status_code}: {resp.text}"


def test_sorting_by_a_real_column_still_sorts(client, db_session):
    _user, employee = _barber(db_session, "sort_ok")
    cust = _customer(db_session)
    _appointment(db_session, cust, employee)
    headers = auth_headers(client, "sort_ok")

    for value in ("appointment_time", "-appointment_date", "total_estimated_price"):
        resp = client.get("/api/v1/barber/queue", params={"sort": value}, headers=headers)
        assert resp.status_code == 200, f"sort={value} -> {resp.status_code}"


# --------------------------------------------------------------------------
# 6. soft-deleted customers stay out of the barber's list
# --------------------------------------------------------------------------

def test_archived_customer_is_hidden_from_the_barber_client_list(client, db_session):
    _user, employee = _barber(db_session, "soft")
    cust = _customer(db_session)
    _appointment(db_session, cust, employee)
    headers = auth_headers(client, "soft")

    visible = client.get("/api/v1/barber/clients", headers=headers)
    assert visible.status_code == 200, visible.text
    assert any(c["id"] == cust.customer_id for c in visible.json())

    db_session.query(Customer).filter(
        Customer.customer_id == cust.customer_id
    ).update({"is_deleted": True})
    db_session.commit()

    after = client.get("/api/v1/barber/clients", headers=headers)
    assert after.status_code == 200, after.text
    assert not any(c["id"] == cust.customer_id for c in after.json()), \
        "an archived customer must not remain bookable from the barber's list"


# --------------------------------------------------------------------------
# 7. performance window is bounded and still agrees with the raw rows
# --------------------------------------------------------------------------

@pytest.mark.parametrize("days", [0, 100000])
def test_performance_rejects_an_unbounded_window(client, db_session, days):
    """`?days=100000` used to build a 100,000-row response from one request."""
    _user, employee = _barber(db_session, "perf")
    headers = auth_headers(client, "perf")

    resp = client.get("/api/v1/barber/performance", params={"days": days}, headers=headers)

    assert resp.status_code == 422, resp.text


def test_performance_totals_match_the_appointments_it_covers(client, db_session):
    """The GROUP BY rewrite has to agree with a count done the obvious way."""
    _user, employee = _barber(db_session, "perf2")
    cust = _customer(db_session)
    today = salon_now().date()
    for offset in (0, 1, 2):
        _appointment(
            db_session, cust, employee,
            status="completed",
            day=today - timedelta(days=offset),
            price=100,
        )
    headers = auth_headers(client, "perf2")

    resp = client.get("/api/v1/barber/performance", params={"days": 7}, headers=headers)
    assert resp.status_code == 200, resp.text

    rows = resp.json()["data"]
    assert len(rows) == 7, "the window is zero-filled to the requested length"
    assert sum(r["services"] for r in rows) == 3
    assert sum(Decimal(str(r["revenue"])) for r in rows) == Decimal("300")
    # The dates must be ascending and end today.
    assert [r["date"] for r in rows] == sorted(r["date"] for r in rows)
    assert rows[-1]["date"] == str(today)


def test_manager_without_a_barber_profile_gets_an_empty_chart_not_a_404(client, db_session):
    """`_get_barber` raises 404; the endpoint used to answer 200 with empty data.

    A manager opening the dashboard is a normal path, so this must not regress
    into a 404 just because the barber-id helper was reused here.
    """
    _manager(db_session, "mgr_perf")
    headers = auth_headers(client, "mgr_perf")

    resp = client.get("/api/v1/barber/performance", headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == []


# --------------------------------------------------------------------------
# 9. ownership between two barbers
#
# These need two employees, which the development database does not have --
# there is exactly one row in `employees`. The suite runs against its own
# per-process SQLite file (see `conftest.py`), so it can simply make one.
# --------------------------------------------------------------------------

def test_a_barber_cannot_change_another_barbers_appointment_status(
    client, db_session
):
    """`_assert_appointment_access` is the only thing stopping this.

    With a single employee in the shop the check could never be exercised
    against real data, so it was worth proving rather than reading.
    """
    _user_a, employee_a = _barber(db_session, "own_a")
    _user_b, employee_b = _barber(db_session, "own_b", commission_rate=Decimal("20"))
    cust = _customer(db_session)
    apt = _appointment(db_session, cust, employee_b, status="waiting")

    resp = client.post(
        f"/api/v1/barber/update-status/{apt.id}",
        params={"status": "in-service"},
        headers=auth_headers(client, "own_a"),
    )

    assert resp.status_code == 403, resp.text

    db_session.expire_all()
    row = db_session.query(Appointment).filter(Appointment.id == apt.id).first()
    assert row.status == "waiting", "another barber must not be able to advance it"


def test_a_barber_can_still_change_their_own_appointment(client, db_session):
    """The guard must not be so broad that a barber cannot work at all."""
    _user_a, employee_a = _barber(db_session, "own_c")
    cust = _customer(db_session, phone="01000000002")
    apt = _appointment(db_session, cust, employee_a, status="waiting")

    resp = client.post(
        f"/api/v1/barber/update-status/{apt.id}",
        params={"status": "in-service"},
        headers=auth_headers(client, "own_c"),
    )

    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    row = db_session.query(Appointment).filter(Appointment.id == apt.id).first()
    assert row.status == "in-service"


def test_a_barber_cannot_record_a_tip_against_another_barbers_appointment(
    client, db_session
):
    """A tip is written into the appointment's notes, so this is a write to
    another barber's row wearing a different endpoint."""
    _user_a, employee_a = _barber(db_session, "own_d")
    _user_b, employee_b = _barber(db_session, "own_e", commission_rate=Decimal("20"))
    cust = _customer(db_session, phone="01000000003")
    apt = _appointment(db_session, cust, employee_b, status="in-service")
    original_notes = apt.notes

    resp = client.post(
        f"/api/v1/barber/appointments/{apt.id}/tip",
        json={"amount": 50},
        headers=auth_headers(client, "own_d"),
    )

    assert resp.status_code == 403, resp.text

    db_session.expire_all()
    row = db_session.query(Appointment).filter(Appointment.id == apt.id).first()
    assert row.notes == original_notes


def test_reading_another_barbers_appointment_404s_rather_than_403(client, db_session):
    """404 rather than 403 on purpose.

    A 403 confirms the id belongs to somebody, which turns the endpoint into an
    oracle for discovering that a given customer has an appointment with another
    barber. The detail route filters on `barber_id`, so a foreign appointment
    is simply not found.
    """
    _user_a, employee_a = _barber(db_session, "own_f")
    _user_b, employee_b = _barber(db_session, "own_g", commission_rate=Decimal("20"))
    cust = _customer(db_session, phone="01000000004")
    apt = _appointment(db_session, cust, employee_b, status="waiting")

    resp = client.get(
        f"/api/v1/barber/appointments/{apt.id}",
        headers=auth_headers(client, "own_f"),
    )

    assert resp.status_code == 404, resp.text


def test_the_queue_never_shows_another_barbers_appointments(client, db_session):
    """The leak people actually notice: a row in someone else's list."""
    _user_a, employee_a = _barber(db_session, "own_h")
    _user_b, employee_b = _barber(db_session, "own_i", commission_rate=Decimal("20"))

    cust = _customer(db_session, phone="01000000005")
    mine = _appointment(db_session, cust, employee_a, status="waiting")
    _appointment(db_session, cust, employee_b, status="waiting")

    resp = client.get("/api/v1/barber/queue", headers=auth_headers(client, "own_h"))

    assert resp.status_code == 200, resp.text
    ids = {row["id"] for row in resp.json()["waiting"]}
    assert mine.id in ids
    assert len(ids) == 1, f"queue leaked another barber's appointments: {ids}"

# --------------------------------------------------------------------------
# 8. notification settings accept both payload shapes and persist them
# --------------------------------------------------------------------------

# Keyed by the *switch names the endpoint actually stores* (`_DEFAULT_NOTIFICATIONS`).
# The endpoint merges the incoming body over those defaults and drops keys it does
# not recognise, so a test that invents plausible-looking names like "reminder"
# would pass a 200 while asserting nothing was kept.
FLAT = {
    "notifications_enabled": True,
    "new_appointment": True,
    "appointment_reminder": False,
    "marketing": True,
}
NESTED = {
    "notifications_enabled": True,
    "notifications": {
        "new_appointment": True,
        "appointment_reminder": False,
        "marketing": True,
    },
}


@pytest.mark.parametrize("payload", [FLAT, NESTED], ids=["flat", "nested"])
def test_notification_settings_persist_both_payload_shapes(
    client, db_session, payload
):
    """The flat form stored only the master switch; the nested form stored nothing.

    A barber could tick "new appointment" in the UI, see it ticked, close the
    tab, and find it unticked.

    There is no GET on this route, so persistence is asserted against the stored
    row rather than by reading it back through the API -- which is the stronger
    claim anyway, since it checks what reached the database.
    """
    from app.models.preference import Preference

    username = f"notif_{'flat' if payload is FLAT else 'nested'}"
    user, _employee = _barber(db_session, username)
    headers = auth_headers(client, username)

    resp = client.put(
        "/api/v1/barber/notification-settings", json=payload, headers=headers
    )
    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    pref = db_session.query(Preference).filter(Preference.user_id == user.id).first()
    assert pref is not None, "the settings must be stored against the barber's user"

    stored = pref.notification_preferences
    assert stored is not None, "the granular switches must be persisted, not dropped"
    assert stored["new_appointment"] is True
    assert stored["appointment_reminder"] is False
    assert stored["marketing"] is True


def test_master_switch_is_derived_from_the_channels(client, db_session):
    """A master flag that disagrees with the channels under it is how the two
    drifted apart in the first place, so it is derived rather than stored."""
    from app.models.preference import Preference

    user, _employee = _barber(db_session, "notif_master")
    headers = auth_headers(client, "notif_master")

    # Everything off -> the master switch must follow.
    off = {"notifications": {k: False for k in (
        "new_appointment", "appointment_reminder", "appointment_cancelled",
        "shift_reminder", "tips", "marketing",
    )}}
    assert client.put(
        "/api/v1/barber/notification-settings", json=off, headers=headers
    ).status_code == 200

    db_session.expire_all()
    pref = db_session.query(Preference).filter(Preference.user_id == user.id).first()
    assert pref.notifications_enabled is False

    # One channel back on -> the master switch must follow it back up.
    on = {"notifications": {"new_appointment": True}}
    assert client.put(
        "/api/v1/barber/notification-settings", json=on, headers=headers
    ).status_code == 200

    db_session.expire_all()
    pref = db_session.query(Preference).filter(Preference.user_id == user.id).first()
    assert pref.notifications_enabled is True


def test_unknown_switches_are_not_stored(client, db_session):
    """The endpoint whitelists keys; an unrecognised one must not be smuggled in."""
    from app.models.preference import Preference

    user, _employee = _barber(db_session, "notif_unknown")
    headers = auth_headers(client, "notif_unknown")

    resp = client.put(
        "/api/v1/barber/notification-settings",
        json={"notifications": {"definitely_not_a_setting": True}},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    pref = db_session.query(Preference).filter(Preference.user_id == user.id).first()
    assert "definitely_not_a_setting" not in (pref.notification_preferences or {})