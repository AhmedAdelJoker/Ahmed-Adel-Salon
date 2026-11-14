"""`GET /employees?q=` — free-text over name and phone.

The add-employee form uses this to catch a phone number that is already on file
before it saves. `/employees/archive` already had the same filter; the live
roster did not, so "is this number taken?" could only be answered by pulling the
whole roster into the browser and paging through it.
"""
from app.models.employee import Employee
from tests.helpers import auth_headers, make_user


def _owner(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    auth_headers(client, "owner1")  # token is cached per-session
    return auth_headers(client, "owner1")


def test_search_finds_an_employee_by_phone(client, db_session):
    headers = _owner(client, db_session)
    db_session.add(
        Employee(
            full_name="أحمد محمد",
            phone_primary="01001234567",
            job_title="barber",
            status="active",
        )
    )
    db_session.commit()

    resp = client.get("/api/v1/employees", params={"q": "01001234567"}, headers=headers)
    assert resp.status_code == 200, resp.text
    names = [e["full_name"] for e in resp.json()]
    assert "أحمد محمد" in names


def test_search_finds_an_employee_by_name(client, db_session):
    headers = _owner(client, db_session)
    db_session.add(
        Employee(
            full_name="أحمد محمد",
            phone_primary="01001234567",
            job_title="barber",
            status="active",
        )
    )
    db_session.commit()

    resp = client.get("/api/v1/employees", params={"q": "أحمد"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1


def test_search_tolerates_partial_digits(client, db_session):
    """A user mid-typing pastes 0100 123 4567; the space must not break the match."""
    headers = _owner(client, db_session)
    db_session.add(
        Employee(
            full_name="سارة",
            phone_primary="01001234567",
            job_title="barber",
            status="active",
        )
    )
    db_session.commit()

    resp = client.get("/api/v1/employees", params={"q": "1234"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert [e["phone_primary"] for e in resp.json()] == ["01001234567"]


def test_search_spans_every_status_including_archived(client, db_session):
    """
    A resigned employee still owns their number: reassigning it silently would
    send their old attendance and payouts to a different person.
    """
    headers = _owner(client, db_session)
    db_session.add(
        Employee(
            full_name="سابق",
            phone_primary="01001234567",
            job_title="barber",
            status="resigned",
        )
    )
    db_session.commit()

    resp = client.get("/api/v1/employees", params={"q": "01001234567"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert [e["status"] for e in resp.json()] == ["resigned"]


def test_search_still_honours_the_other_filters(client, db_session):
    headers = _owner(client, db_session)
    db_session.add_all(
        [
            Employee(
                full_name="مStay",
                phone_primary="01001234567",
                job_title="barber",
                status="active",
            ),
            Employee(
                full_name="مقيد",
                phone_primary="01001234567",
                job_title="manager",
                status="active",
            ),
        ]
    )
    db_session.commit()

    resp = client.get(
        "/api/v1/employees",
        params={"q": "01001234567", "job_title": "manager"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert [e["full_name"] for e in resp.json()] == ["مقيد"]


def test_no_search_term_returns_everything(client, db_session):
    headers = _owner(client, db_session)
    db_session.add_all(
        [
            Employee(full_name="أ", phone_primary="01000000001", job_title="barber", status="active"),
            Employee(full_name="ب", phone_primary="01000000002", job_title="barber", status="active"),
        ]
    )
    db_session.commit()

    resp = client.get("/api/v1/employees", headers=headers)
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 2