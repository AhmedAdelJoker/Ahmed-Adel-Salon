"""The self-service profile update.

The email field on the profile form is optional and not `required`, so leaving
it blank sends `""`. `EmailStr` rejects the empty string, and the user was
answered with a 422 they could not act on — for having left an optional field
alone.
"""
from app.models.user import User
from tests.helpers import auth_headers, make_user


def _user(client, db_session, username, email):
    """`make_user` has no email parameter, so it is stamped afterwards."""
    make_user(db_session, username=username)
    row = db_session.query(User).filter(User.username == username).first()
    row.email = email
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    return auth_headers(client, username)


def _profile(client, headers, payload):
    return client.put("/api/v1/profile", json=payload, headers=headers)


def test_a_blank_email_clears_rather_than_422s(client, db_session):
    headers = _user(client, db_session, "carol", "carol@example.com")

    resp = _profile(client, headers, {"full_name": "Carol", "email": ""})
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] is None


def test_whitespace_only_email_is_also_blank(client, db_session):
    headers = _user(client, db_session, "dan", "dan@example.com")

    resp = _profile(client, headers, {"email": "   "})
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] is None


def test_a_real_email_still_validates(client, db_session):
    """The fix must not turn the field into a free-text column."""
    headers = _user(client, db_session, "erin", "erin@example.com")

    assert _profile(client, headers, {"email": "not-an-email"}).status_code == 422
    assert _profile(client, headers, {"email": "erin2@example.com"}).status_code == 200


def test_omitting_email_leaves_it_alone(client, db_session):
    headers = _user(client, db_session, "frank", "frank@example.com")

    resp = _profile(client, headers, {"full_name": "Frank"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == "frank@example.com"


def test_clearing_a_blank_employee_field_clears_it(client, db_session):
    """The same rule has to cover the linked-employee fields.

    `display_name` and `bio_ar` are optional on the form too, and the frontend
    sent `null` for a blanked one. Under the old `is not None` guard that null
    was indistinguishable from an absent key, so the cleared field reappeared.
    """
    from app.models.employee import Employee

    make_user(db_session, username="gina", role="barber")
    user = db_session.query(User).filter(User.username == "gina").first()
    employee = Employee(
        full_name="Gina",
        phone_primary="01000000007",
        job_title="barber",
        display_name="Gina B.",
        bio_ar="أفضل حلاقة في المدينة",
    )
    db_session.add(employee)
    db_session.commit()
    user.employee = employee
    db_session.add(user)
    db_session.commit()
    db_session.refresh(employee)

    headers = auth_headers(client, "gina")
    resp = _profile(client, headers, {"display_name": None, "bio_ar": None})
    assert resp.status_code == 200, resp.text
    assert resp.json()["display_name"] is None
    assert resp.json()["bio_ar"] is None

    # The test session still holds the object it added, so expire it before
    # re-reading what the request actually wrote.
    db_session.expire_all()
    row = db_session.query(Employee).filter(Employee.id == employee.id).first()
    assert row.display_name is None
    assert row.bio_ar is None
