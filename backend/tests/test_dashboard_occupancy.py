"""`/owner/dashboard-stats` must not invent an occupancy figure.

The endpoint computed occupancy inside a try/except whose handler read:

    except Exception:
        occupancy = 72

A failed query therefore reported 72% beside six genuinely measured figures.
Nothing about the result looked wrong -- 72% is an ordinary occupancy rate --
which is what let it survive review. A fabricated number shaped like the real
ones is the kind nobody checks twice.

`occupancy` is now `None` when it cannot be computed, and `None` is not zero:
zero means the salon was empty, which is a fact. These tests hold both ends of
that distinction.
"""

from app.models.employee import Employee
from tests.helpers import auth_headers, make_user


def _owner_headers(client, db_session):
    make_user(db_session, username="occ_owner", role="owner")
    return auth_headers(client, username="occ_owner")


def test_occupancy_is_a_real_number_when_the_query_works(client, db_session):
    headers = _owner_headers(client, db_session)

    resp = client.get("/api/v1/owner/dashboard-stats", headers=headers)

    assert resp.status_code == 200, resp.text
    occupancy = resp.json()["stats"]["occupancy"]

    # An empty salon is 0, and that is a measurement, not a placeholder.
    assert occupancy == 0, resp.text


def test_occupancy_is_null_when_the_count_cannot_be_computed(client, db_session, monkeypatch):
    """The regression itself.

    `db.query` belongs to this test's session; the endpoint builds its own from
    `get_db`, so patching it here would not reach the code under test. Instead
    the `Employee` symbol inside the endpoint module is replaced with something
    that raises on attribute access, which is exactly the shape of failure the
    `except` clause was there to catch.

    The rest of the dashboard keeps reporting real figures throughout. That
    isolation is the point: the old handler produced 72 while everything else
    looked healthy, so nothing on the page indicated a failure had occurred.
    """
    from app.api.v1.endpoints import owner as owner_module

    headers = _owner_headers(client, db_session)

    class _ExplodingEmployee:
        @property
        def id(self):
            raise RuntimeError("simulated database failure")

    monkeypatch.setattr(owner_module, "Employee", _ExplodingEmployee)

    resp = client.get("/api/v1/owner/dashboard-stats", headers=headers)

    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["stats"]["occupancy"] is None, (
        f"expected null, got {body['stats']['occupancy']!r}"
    )
    # The specific lie being removed, pinned so it cannot come back.
    assert body["stats"]["occupancy"] != 72

    # Everything else still reported, which is why a fabricated occupancy was so
    # easy to miss.
    assert "todayRevenue" in body["stats"]


def test_the_payload_never_carries_the_old_fallback(client, db_session):
    headers = _owner_headers(client, db_session)

    stats = client.get("/api/v1/owner/dashboard-stats", headers=headers).json()["stats"]

    # On an empty database the honest answer is 0. The moment 72 appears here it
    # came from a fallback rather than from counting appointments.
    assert stats["occupancy"] in (0, None), stats["occupancy"]