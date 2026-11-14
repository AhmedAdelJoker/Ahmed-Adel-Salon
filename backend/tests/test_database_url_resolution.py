"""A relative sqlite URL resolves to the canonical external database.

`session.py` used to guard its "relative → external data dir" redirect with
`":/" in url`, which is true for every sqlite URL — the `sqlite:///` prefix
contains `:/` itself. So the redirect never ran, SQLAlchemy resolved
`./salon_pro.db` against the working directory, and the dev backend wrote
`backend/salon_pro.db` while its uploads went to `SalonPro_External/data/uploads`.
Electron spawns the packaged backend with an absolute URL, so the packaged app
used the *other* database; the two diverged (23 appointments vs 20, 2 employees
vs 1) and a photo the dev database still referenced was 404ing because the file
lived only in the packaged app's world.

The behaviour worth pinning down is not "the string changed" but:
an absolute URL is left alone, an in-memory URL is left alone, and a relative
one lands on the external database — the same file the packaged app opens.
"""
from pathlib import Path

import pytest

from app.core import paths
from app.core.config import settings
from app.core.paths import resolve_database_url


def test_a_relative_url_is_repointed_at_the_external_database(monkeypatch):
    external = Path("C:/canonical/data/salon_pro.db")
    monkeypatch.setattr(paths, "get_db_path", lambda: external)

    resolved = resolve_database_url("sqlite:///./salon_pro.db")

    assert resolved == "sqlite:///C:/canonical/data/salon_pro.db"


def test_a_relative_url_without_the_dot_slash_is_still_relative(monkeypatch):
    external = Path("C:/canonical/data/salon_pro.db")
    monkeypatch.setattr(paths, "get_db_path", lambda: external)

    resolved = resolve_database_url("sqlite:///salon_pro.db")

    assert resolved == "sqlite:///C:/canonical/data/salon_pro.db"


@pytest.mark.parametrize(
    "url",
    [
        # Electron passes an absolute path; it must win over the external default.
        "sqlite:///C:/SalonProData/data/salon_pro.db",
        r"sqlite:///C:\SalonProData\data\salon_pro.db",
        "sqlite:////var/lib/salon/salon_pro.db",
        "sqlite:///:memory:",
        "sqlite:///file:memdb1?mode=memory&cache=shared",
        "sqlite://",
        "postgresql://salon:secret@localhost/salon",
    ],
)
def test_absolute_memory_and_non_sqlite_urls_are_left_alone(url):
    assert resolve_database_url(url) == url


def test_the_suite_never_points_at_the_real_external_database():
    """The test database must stay an absolute path outside the data dir.

    With relative URLs now redirected, a relative test URL would silently
    become the user's real database — the suite creates and drops rows, so
    that is not a near miss, it is data loss. `conftest` hands the app an
    absolute `test_<pid>.db`; this is the tripwire if that ever regresses.
    """
    url = settings.DATABASE_URL

    assert "test_" in url, f"the suite is not on a test database: {url}"
    assert "SalonPro_External" not in url, f"the suite points at real data: {url}"
