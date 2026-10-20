"""Tests for the authorisation audit.

The audit itself is a script that walks the FastAPI router tree and classifies
every endpoint. It is easy to write one that reports "clean" for the wrong
reason, and that is exactly what happened twice while building it:

1. It iterated `app.routes` directly. This FastAPI version nests included routers
   behind a private `_IncludedRouter` wrapper, so the walk saw thirteen entries,
   found two real endpoints, and printed "1 route needs a decision" -- an
   all-clear from a script that had examined two routes out of several hundred.

2. Every role gate in `app/api/deps.py` is a closure returned by `require_roles`,
   so all of them share the inner name `dependency`. The audit's name-based
   detection could not tell them apart and reported 155 unguarded mutations,
   including a permanently-deletes-customers endpoint that has always required
   `require_owner`.

Both failures had the same signature: a suspiciously small or round number, and
a green result. So the tests below do not check the audit's verdict on the
application -- the application has no holes and that is asserted separately
against real endpoints. They check that the audit can still *see*, because an
audit that cannot see is worse than none: it produces the confidence of a clean
result with none of the work.

The reason these are hard-coded numbers rather than "more than zero" is that a
regression here is a *drop* in coverage. `> 0` would pass on an audit that
suddenly examined one route.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# No environment is staged here. `load_audit()` executes the script, which
# provisions its own stubs before it imports the application, and duplicating
# that list in this file is how the two copies drifted apart in the first place.


def load_audit():
    spec = importlib.util.spec_from_file_location(
        "audit_authorization", BACKEND_ROOT / "scripts" / "audit_authorization.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def audit():
    return load_audit()


@pytest.fixture(scope="module")
def rows(audit):
    return audit.classify(audit.app)


# --------------------------------------------------------------------------
# The audit can still see the application
# --------------------------------------------------------------------------


def test_the_audit_walks_past_included_routers(rows):
    """The `_IncludedRouter` regression, pinned.

    `app.routes` holds thirteen entries and two APIRoutes. Everything else is
    behind a wrapper, so a top-level-only walk silently examines 2 of ~330.
    """
    assert len(rows) > 300, (
        f"the audit only classified {len(rows)} routes; it is probably not "
        "descending into included routers again"
    )


def test_the_audit_reaches_both_halves_of_the_api(audit):
    """Sanity: routes from more than one router are present.

    A single missed wrapper could still leave hundreds of routes visible, so
    this checks that both a staff path and a public path survived the walk.
    """
    paths = {row["path"] for row in audit.classify(audit.app)}
    assert any(p.startswith("/appointments") for p in paths), "staff router missing"
    assert any(p.startswith("/public") for p in paths), "public router missing"
    assert any(p.startswith("/auth") for p in paths), "auth router missing"


def test_the_audit_does_not_invent_routes(rows):
    """A count with no upper bound is satisfied by a runaway walk.

    `os.walk` into a `StaticFiles` mount, or into a route twice, inflates the
    number and would satisfy `> 300` forever.
    """
    assert len(rows) < 800, f"{len(rows)} routes is implausible; the walk is likely doubling up"


def test_every_classified_route_is_accounted_for(rows):
    """No route may be silently dropped from the report.

    An unclassified route would mean the walk found it and could not decide what
    it is, which is the same failure as not finding it.
    """
    assert all(row["kind"] in {"OK", "PUBLIC", "SELF_SERVICE", "UNPROTECTED", "MUTATING_NO_ROLE", "NO_ROLE_CHECK"} for row in rows)
    assert all(row["method"] and row["path"] for row in rows)


# --------------------------------------------------------------------------
# The audit identifies role gates at all
# --------------------------------------------------------------------------


def test_role_gates_are_named_after_what_they_enforce(audit):
    """The closure-naming regression, pinned.

    `require_roles` returns a closure. Without an explicit `__name__` every gate
    is called `dependency` and no name-based tool can tell `require_owner` from
    `require_any_staff`.
    """
    from app.api.deps import require_owner, require_roles

    made = require_roles("admin", "owner")
    assert made.__name__ == "require_roles[admin|owner]"
    assert made.__qualname__ == made.__name__
    assert "admin" in require_owner.__name__ and "owner" in require_owner.__name__


def test_the_audit_detects_a_role_gate_where_one_exists(rows):
    """The 155-false-positive regression, pinned.

    `DELETE /customers/archive/bulk-permanent` permanently destroys customer
    records. It requires the owner role and always has. If the audit cannot see
    that, it is reporting a hole that is not there, and the number it reports is
    meaningless.
    """
    target = [
        row
        for row in rows
        if row["method"] == "DELETE" and row["path"].endswith("/archive/bulk-permanent")
    ]
    assert target, "the destructive customer endpoint vanished from the audit"
    assert target[0]["auth"] is True
    assert target[0]["role"] is True, (
        "a permanently destructive endpoint reads as having no role check; the "
        "audit cannot be distinguishing require_owner"
    )


def test_the_audit_detects_several_different_gates(rows):
    """More than one gate must be distinguishable, not just `require_owner`.

    A detector that matches one hard-coded name would pass the test above while
    missing every other gate, which is the same blindness with more confidence.
    """
    found = set()
    for row in rows:
        found.update(row["deps"])
    role_gates = {n for n in found if n.startswith("require_roles[")}
    assert len(role_gates) >= 4, (
        f"only {len(role_gates)} distinct role gates observed ({role_gates}); "
        "the audit is probably matching a single hard-coded name"
    )


# --------------------------------------------------------------------------
# The application has no holes
# --------------------------------------------------------------------------


def test_no_endpoint_is_entirely_unauthenticated(rows):
    """Every route must authenticate or be on the deliberate public list.

    The previous version of this test allowed any path beginning with `/` or
    `/health`, which is every path in the application -- `"/auth/login"
    .startswith("/")` is true. It therefore could not fail, and it sat here
    looking like the backstop for exactly the defect it was hiding: 17
    deliberately public routes, six of them listed in `EXPECTED_PUBLIC` with an
    `/api/v1` prefix the classifier's paths never carry, all reported as
    UNPROTECTED on every run of the gate.

    There is no allowlist here now. A route that is genuinely public has to be
    registered in the script, and that registration is itself checked against the
    real route table by `test_no_registered_route_is_stale`. Root and health are
    registered there like everything else.
    """
    unlisted = [
        f"{row['method']} {row['path']}"
        for row in rows
        if row["kind"] == "UNPROTECTED"
    ]
    assert not unlisted, (
        f"unauthenticated endpoints: {unlisted}\n"
        "If one of these is meant to be public, register it in "
        "scripts/audit_authorization.py with a comment saying why it is safe."
    )


def test_no_registered_route_is_stale(rows, audit):
    """A whitelist entry that matches no route is a claim, not a protection.

    Six entries in `EXPECTED_PUBLIC` named routes that do not exist
    (`/health/live`, `/meta`, `/auth/totp/verify`,
    `/public/booking/availability`), and the four that did match were the ones
    written without a prefix. Nobody noticed, because an entry that matches
    nothing and an entry that matches everything look identical in a report that
    only prints the ones that failed.

    A typo here is the dangerous direction: registering `/review/public` instead
    of `/reviews/public` would look like the public review list had been reviewed
    while `POST /reviews` sat unauthenticated and unrated in the same file.
    """
    real = {(row["method"], row["path"]) for row in rows}
    registered = (audit.EXPECTED_PUBLIC | audit.EXPECTED_SELF_SERVICE) - audit.NOT_WALKABLE
    stale = sorted(f"{method} {path}" for method, path in registered - real)
    assert not stale, (
        f"registered but not a real route: {stale}\n"
        "Either the route was renamed or removed, or the path is misspelled."
    )


def test_every_mutating_endpoint_either_has_a_role_or_is_self_service(rows, audit):
    """The remaining ungated mutations must all be self-service.

    Own profile, own password, own 2FA and own logout belong to whoever is signed
    in and need no role. Anything that touches another person's data, money, or
    configuration does.

    The list lives in the audit script, not here, and this asserts against the
    same set the gate does. It used to be a private tuple of path *suffixes*
    living only in this file, which meant the script could not tell self-service
    from a hole -- the two lists were describing the same ten routes and neither
    could see the other. Exact (method, path) pairs now, in one place, so a route
    that stops being self-service no longer matches by accident.
    """
    offending = [
        f"{row['method']} {row['path']}"
        for row in rows
        if row["kind"] == "MUTATING_NO_ROLE"
        and (row["method"], row["path"]) not in audit.EXPECTED_SELF_SERVICE
    ]
    assert not offending, (
        "mutating endpoints with no role check that are not self-service: "
        f"{offending}"
    )

