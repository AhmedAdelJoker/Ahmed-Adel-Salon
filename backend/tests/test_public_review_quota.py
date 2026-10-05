"""`POST /reviews` is public on purpose, and metered on purpose.

Two facts about one endpoint, and the second only exists because of the first.

It is public because a customer leaves a review from the public site and has no
account to log in with, so requiring a session would mean nobody could use the
feature. That is a product decision, and it is recorded as one in
`EXPECTED_PUBLIC` in `scripts/audit_authorization.py` -- which is what stops the
authorisation audit from reporting it as a hole on every run.

It is metered because public and unmetered is a table anyone can grow from the
internet. `barber_id` is stripped from the payload, so nobody can post a rating
against a barber they did not visit, and the appointment branch binds the review
to that appointment's own customer and employee. What was missing was any bound
on volume, so `create_review` takes the same public quota the booking endpoints
use, in its own bucket.

The last test asserts the limiter returns 429 rather than only inspecting the
route, because attachment is not enforcement: a dependency on the wrong
decorator, or one whose key collides with another bucket, satisfies an inspection
of the route and still lets an unbounded writer through. The limiter state is
reset between tests by the autouse `setup_database` fixture in `conftest.py`.
"""

from __future__ import annotations

from fastapi.routing import APIRoute

from app.api.v1.endpoints import reviews as reviews_module
from app.core.config import settings
from app.core.rate_limit import rate_limit

PAYLOAD = {"rating": 5, "comment": "خدمة ممتازة", "customer_name_snapshot": "عميل"}


def _create_route() -> APIRoute:
    return next(
        route
        for route in reviews_module.router.routes
        if isinstance(route, APIRoute)
        and route.path == "/reviews"
        and "POST" in route.methods
    )


def test_the_route_carries_a_quota():
    gates = [
        getattr(dep.call, "__name__", type(dep.call).__name__)
        for dep in _create_route().dependant.dependencies
    ]
    assert any(name.startswith("rate_limit[") for name in gates), (
        f"POST /reviews has no rate-limit dependency; found {gates}. It is "
        "unauthenticated by design, so the quota is the only thing bounding it."
    )


def test_the_limiter_is_named_after_its_bucket():
    """A quota an auditor cannot see is indistinguishable from no quota.

    The authorisation audit reads dependency *names*, and the closure returned by
    `rate_limit` was called `dependency` -- which is what every unnamed FastAPI
    closure is called. A throttled route and an unprotected one therefore printed
    identically in its report.
    """
    made = rate_limit("public_review_create", max_requests=5, window_seconds=60)
    assert made.__name__ == "rate_limit[public_review_create]"
    assert made.__qualname__ == made.__name__


def test_the_limiter_name_is_not_an_auth_marker():
    """Naming it so it reads like a gate would let it stand in for identity.

    A quota bounds volume. It says nothing about who is calling, so the name must
    not satisfy the audit's `AUTH_MARKERS`: a rate-limited public endpoint still
    has to be registered as deliberately public, and this is why.
    """
    made = rate_limit("public_review_create", max_requests=5, window_seconds=60)
    for marker in ("current_user", "current_active_user", "get_current", "require_auth"):
        assert marker not in made.__name__, f"{marker!r} must not match a quota"


def test_posting_reviews_stops_after_the_quota(client):
    """The behaviour, not the wiring: N accepted, then 429 with Retry-After."""
    quota = settings.PUBLIC_RATE_LIMIT_MAX_REQUESTS
    accepted = 0
    response = None

    for _ in range(quota + 2):
        response = client.post("/api/v1/reviews", json=PAYLOAD)
        if response.status_code == 429:
            break
        assert response.status_code == 201, response.text
        accepted += 1

    assert accepted == quota, (
        f"{accepted} reviews were accepted with a quota of {quota}; the limiter "
        "is attached but not enforcing"
    )
    assert response is not None and response.status_code == 429, "the quota never engaged"
    assert "Retry-After" in response.headers
