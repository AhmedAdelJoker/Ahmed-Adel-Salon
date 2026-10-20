"""Barber photo upload.

`POST /barbers/upload-image` used to be a stub: it took no `file` parameter,
saved nothing, and answered with `/uploads/profiles/default.png` — a path
nothing ever writes and nothing serves. Any caller that trusted that URL
rendered a broken image, and the one caller that did (the barber's own profile
page) was showing a `FileReader` data URL that was discarded on save, so picking
a photo appeared to work and changed nothing.

The route is also what the frontend's own `api.put("/barbers/{id}")` no longer
needs to know about: it stores the file and links the row in one step, so a
partial profile save cannot drop the photo.
"""
from io import BytesIO

from PIL import Image

from app.models.employee import Employee
from app.models.user import User
from tests.helpers import auth_headers, make_user


def _jpeg_bytes() -> bytes:
    """A real, decodable JPEG.

    Hand-written SOI/EOI bytes pass `validate_image`, which sniffs magic bytes
    only, but `process_image_content` hands the file to Pillow and a bare
    header is not an image — so the upload answers 400 before anything is
    written.
    """
    buffer = BytesIO()
    Image.new("RGB", (2, 2), (200, 30, 30)).save(buffer, format="JPEG")
    return buffer.getvalue()


_JPEG = _jpeg_bytes()


def _barber_with_employee(db_session, username):
    make_user(db_session, username=username, role="barber")
    user = db_session.query(User).filter(User.username == username).first()
    employee = Employee(
        full_name=f"Barber {username}",
        phone_primary=f"0100000{len(username):04d}",
        job_title="barber",
    )
    db_session.add(employee)
    db_session.commit()
    user.barber_id = employee.id
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user, employee


def _upload(client, headers):
    return client.post(
        "/api/v1/barbers/upload-image",
        headers=headers,
        files={"file": ("me.jpg", BytesIO(_JPEG), "image/jpeg")},
    )


def test_upload_returns_a_real_path_that_is_served(client, db_session):
    _user, employee = _barber_with_employee(db_session, "amir")
    headers = auth_headers(client, "amir")

    resp = _upload(client, headers)
    assert resp.status_code == 200, resp.text
    url = resp.json()["url"]

    # The stub answered with a path to a file nothing ever writes. Assert the
    # returned path is the one that was just created, and that it serves bytes.
    assert url.startswith("/uploads/profiles/")
    assert not url.endswith("default.png")

    db_session.expire_all()
    row = db_session.query(Employee).filter(Employee.id == employee.id).first()
    assert row.profile_image_url == url

    served = client.get(url)
    assert served.status_code == 200
    assert served.content[:2] == b"\xff\xd8"  # JPEG magic


def test_a_barber_cannot_upload_onto_someone_elses_row(client, db_session):
    _user, _mine = _barber_with_employee(db_session, "amir")
    _other, _theirs = _barber_with_employee(db_session, "bilal")
    headers = auth_headers(client, "amir")

    # The route writes the uploader's own row only; `bilal`'s must be untouched
    # even though the request is nominally valid.
    resp = _upload(client, headers)
    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    bilal = (
        db_session.query(Employee)
        .filter(Employee.full_name == "Barber bilal")
        .first()
    )
    assert bilal.profile_image_url is None


def test_a_manager_may_upload_without_owning_a_barber_row(client, db_session):
    make_user(db_session, username="mgr", role="manager")
    headers = auth_headers(client, "mgr")

    resp = _upload(client, headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["url"].startswith("/uploads/profiles/")


def test_a_non_staff_user_is_refused(client, db_session):
    make_user(db_session, username="cash1", role="cashier")
    headers = auth_headers(client, "cash1")

    assert _upload(client, headers).status_code == 403
