from datetime import date, datetime, time, timedelta

from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.user import User
from tests.helpers import auth_headers, make_user


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def _seed(db_session, name, phone, status):
    emp = Employee(
        full_name=name,
        phone_primary=phone,
        job_title="barber",
        status=status,
        is_active=(status == "active"),
    )
    db_session.add(emp)
    db_session.commit()
    db_session.refresh(emp)
    return emp


def test_archive_requires_auth(client):
    resp = client.get("/api/v1/employees/archive")
    assert resp.status_code in (401, 403)


def test_archive_forbidden_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.get("/api/v1/employees/archive", headers=auth_headers(client))
    assert resp.status_code == 403


def test_archive_returns_only_resigned(client, db_session):
    """The archive is for leavers only.

    An employee "on vacation" keeps `status='suspended'` and stays in the main
    team list with a badge — not here. Only people who actually left the salon
    (`resigned`) belong in the archive.
    """
    headers = _owner_headers(client, db_session)
    _seed(db_session, "Active One", "01000000001", "active")
    _seed(db_session, "On Vacation One", "01000000002", "suspended")
    _seed(db_session, "Resigned One", "01000000003", "resigned")

    resp = client.get("/api/v1/employees/archive", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert [e["status"] for e in body] == ["resigned"]
    assert body[0]["full_name"] == "Resigned One"


def test_archive_status_filter_and_search(client, db_session):
    headers = _owner_headers(client, db_session)
    _seed(db_session, "On Vacation One", "01000000002", "suspended")
    _seed(db_session, "Resigned One", "01000000003", "resigned")

    resp = client.get(
        "/api/v1/employees/archive", params={"status": "resigned"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert [e["full_name"] for e in resp.json()] == ["Resigned One"]

    # "suspended" is no longer an archived status, so the filter cannot carve a
    # vacationer out of the archive — there is nothing of them in it to begin
    # with.
    resp = client.get(
        "/api/v1/employees/archive", params={"status": "suspended"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert [e["full_name"] for e in resp.json()] == ["Resigned One"]

    resp = client.get(
        "/api/v1/employees/archive", params={"q": "Resigned"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1
    assert resp.json()[0]["status"] == "resigned"


def test_employee_list_pagination_headers(client, db_session):
    headers = _owner_headers(client, db_session)
    _seed(db_session, "Active One", "01000000011", "active")
    _seed(db_session, "Active Two", "01000000012", "active")
    _seed(db_session, "Active Three", "01000000013", "active")

    resp = client.get(
        "/api/v1/employees",
        params={"page": 1, "page_size": 2},
        headers=headers,
    )

    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 2
    assert resp.headers["X-Total-Count"] == "3"
    assert resp.headers["X-Page"] == "1"


# ── The archive as an event, not a field write ─────────────────────────────
#
# Archiving used to be `PUT {status: "resigned", showInPos: false,
# showInBooking: false}` and restoring was `PUT {status: "active"}`. The pair
# lost the two switches on the way out and never put them back, so a returned
# employee sat in the team list invisible at the till and on the booking site.
# Every operational surface already filters on `status == 'active'` and
# `is_active`, so the wipe hid nothing extra in the first place.


def _archive(client, headers, employee_id, body=None):
    return client.post(
        f"/api/v1/employees/{employee_id}/archive", json=body or {}, headers=headers
    )


def _restore(client, headers, employee_id):
    return client.post(f"/api/v1/employees/{employee_id}/restore", headers=headers)


def test_archive_records_who_when_why_and_leaves_the_switches_alone(
    client, db_session
):
    from datetime import date

    headers = _owner_headers(client, db_session)
    emp = _seed(db_session, "Resigning Barber", "01000000031", "active")

    resp = _archive(
        client,
        headers,
        emp.id,
        {"reason": "resignation", "effectiveDate": date.today().isoformat()},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "resigned"
    assert body["isActive"] is False
    assert body["showInPos"] is True
    assert body["showInBooking"] is True

    db_session.expire_all()
    row = db_session.query(Employee).filter(Employee.id == emp.id).first()
    assert row.archived_at is not None
    assert row.archive_reason == "resignation"
    assert row.archived_by_user_id is not None


def test_restore_leaves_the_employee_visible_at_the_till(client, db_session):
    """The regression the archive page shipped with.

    Proved through `/employees/pos` rather than the row: the till is the
    surface that went quiet, and it is the one that filters on the switches the
    old restore forgot about.
    """
    headers = _owner_headers(client, db_session)
    emp = _seed(db_session, "Comeback Barber", "01000000032", "active")

    assert _archive(client, headers, emp.id, {"reason": "resignation"}).status_code == 200

    pos_ids = [e["id"] for e in client.get("/api/v1/employees/pos", headers=headers).json()]
    assert emp.id not in pos_ids

    assert _restore(client, headers, emp.id).status_code == 200

    pos_ids = [e["id"] for e in client.get("/api/v1/employees/pos", headers=headers).json()]
    assert emp.id in pos_ids


def test_archiving_by_field_write_is_refused(client, db_session):
    """A `resigned` row with no departure date is the bug, not a shortcut."""
    headers = _owner_headers(client, db_session)
    emp = _seed(db_session, "Hand Flipped One", "01000000033", "active")

    resp = client.put(
        f"/api/v1/employees/{emp.id}", json={"status": "resigned"}, headers=headers
    )
    assert resp.status_code == 400, resp.text

    db_session.expire_all()
    row = db_session.query(Employee).filter(Employee.id == emp.id).first()
    assert row.status == "active"


def test_archive_closes_the_staff_login_and_restore_reopens_it(client, db_session):
    headers = _owner_headers(client, db_session)
    staff_user = make_user(db_session, username="staff1", role="barber")
    emp = _seed(db_session, "Logged Barber", "01000000034", "active")
    emp.user_id = staff_user.id
    db_session.add(emp)
    db_session.commit()

    before = staff_user.token_version or 0
    assert _archive(client, headers, emp.id, {"reason": "resignation"}).status_code == 200

    db_session.expire_all()
    usr = db_session.query(User).filter(User.id == staff_user.id).first()
    assert usr.is_active is False
    assert usr.token_version > before, "tokens minted before leaving must not still work"

    assert _restore(client, headers, emp.id).status_code == 200

    db_session.expire_all()
    usr = db_session.query(User).filter(User.id == staff_user.id).first()
    assert usr.is_active is True


def test_effective_date_is_a_day_that_already_happened(client, db_session):
    headers = _owner_headers(client, db_session)
    emp = _seed(db_session, "Dated Exit", "01000000035", "active")
    emp.hire_date = datetime(2024, 1, 1)
    db_session.add(emp)
    db_session.commit()

    future = (date.today() + timedelta(days=3)).isoformat()
    resp = _archive(client, headers, emp.id, {"effectiveDate": future})
    assert resp.status_code == 400, resp.text

    db_session.expire_all()
    assert db_session.query(Employee).filter(Employee.id == emp.id).first().status == "active"

    before_hire = _archive(
        client, headers, emp.id, {"effectiveDate": date(2023, 6, 1).isoformat()}
    )
    assert before_hire.status_code == 400, before_hire.text

    agreed = _archive(
        client, headers, emp.id, {"effectiveDate": date(2025, 9, 1).isoformat()}
    )
    assert agreed.status_code == 200, agreed.text

    db_session.expire_all()
    row = db_session.query(Employee).filter(Employee.id == emp.id).first()
    assert row.status == "resigned"

    # Read back through the list, because the day the owner agreed is what the
    # archive page has to print -- an instant converts to a different calendar
    # day in every timezone that is not the shop's.
    rows = client.get("/api/v1/employees/archive", params={"q": "Dated"}, headers=headers).json()
    assert [r["archived_on"] for r in rows] == ["2025-09-01"]


def test_archive_impact_counts_bookings_that_have_not_happened_yet(
    client, db_session
):
    headers = _owner_headers(client, db_session)
    emp = _seed(db_session, "Busy Barber", "01000000036", "active")
    customer = Customer(first_name="Test", last_name="Customer", phone="01077700036")
    db_session.add(customer)
    db_session.commit()

    db_session.add(
        Appointment(
            customer_id=customer.customer_id,
            barber_id=emp.id,
            appointment_date=date.today() + timedelta(days=2),
            appointment_time=time(15, 0),
            status="confirmed",
        )
    )
    db_session.add(
        Appointment(
            customer_id=customer.customer_id,
            barber_id=emp.id,
            appointment_date=date.today() + timedelta(days=4),
            appointment_time=time(16, 0),
            status="cancelled",
        )
    )
    db_session.commit()

    resp = client.get(f"/api/v1/employees/{emp.id}/archive-impact", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["futureAppointments"] == 1, "a cancelled booking does not strand anyone"
    assert body["showInBooking"] is True


def test_archive_list_totals_and_shows_a_date_not_an_instant(client, db_session):
    headers = _owner_headers(client, db_session)
    for i in range(3):
        emp = _seed(db_session, f"Leaver {i}", f"0100000004{i}", "active")
        assert _archive(client, headers, emp.id, {"reason": "resignation"}).status_code == 200

    resp = client.get("/api/v1/employees/archive", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.headers["X-Total-Count"] == "3"
    rows = resp.json()
    assert all(r["archived_on"] for r in rows)
    # A date, not an instant: an ISO timestamp is what made the page print the
    # day before the real one when read from another zone.
    assert all(len(r["archived_on"]) == 10 for r in rows)


def test_legacy_resigned_row_keeps_an_empty_departure_date(client, db_session):
    """Nobody agreed a leaving day for these, so nothing invents one.

    Back-filling from `updated_at` would put a date into a payroll dispute that
    no person ever stated, and the page would present it as fact.
    """
    headers = _owner_headers(client, db_session)
    _seed(db_session, "Old Leaver", "01000000045", "resigned")

    rows = client.get("/api/v1/employees/archive", headers=headers).json()
    assert [r["full_name"] for r in rows] == ["Old Leaver"]
    assert rows[0]["archived_at"] is None
    assert rows[0]["archived_on"] is None


def test_stats_count_the_roster_and_not_the_page_being_shown(client, db_session):
    headers = _owner_headers(client, db_session)
    _seed(db_session, "A One", "01000000051", "active")
    _seed(db_session, "A Two", "01000000052", "active")
    _seed(db_session, "On Leave", "01000000053", "suspended")
    _seed(db_session, "Left", "01000000054", "resigned")

    resp = client.get("/api/v1/employees/stats", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {
        "total": 4,
        "active": 2,
        "suspended": 1,
        "resigned": 1,
        "barbers": 2,
        "assistants": 0,
    }

    # Turning the page must not move the headline.
    page = client.get(
        "/api/v1/employees", params={"page": 1, "page_size": 1}, headers=headers
    ).json()
    assert len(page) == 1
    assert client.get("/api/v1/employees/stats", headers=headers).json()["total"] == 4


def test_team_list_can_drop_leavers_on_the_server(client, db_session):
    """`exclude_status` is what keeps count and rows agreeing while paging."""
    headers = _owner_headers(client, db_session)
    _seed(db_session, "Still Here", "01000000061", "active")
    _seed(db_session, "Gone", "01000000062", "resigned")

    resp = client.get(
        "/api/v1/employees", params={"excludeStatus": "resigned"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert [e["full_name"] for e in resp.json()] == ["Still Here"]
    assert resp.headers["X-Total-Count"] == "1"


def test_roster_rows_carry_the_fields_the_board_displays(client, db_session):
    headers = _owner_headers(client, db_session)
    emp = _seed(db_session, "Tenured Barber", "01000000071", "active")

    db_session.expire_all()
    row = db_session.query(Employee).filter(Employee.id == emp.id).first()
    row.hire_date = datetime(2023, 5, 1)
    db_session.add(row)
    db_session.commit()

    rows = client.get("/api/v1/employees", headers=headers).json()
    me = [r for r in rows if r["id"] == emp.id][0]
    assert me["hire_date"] is not None
    assert me["show_in_pos"] is True
    assert me["show_in_booking"] is True
