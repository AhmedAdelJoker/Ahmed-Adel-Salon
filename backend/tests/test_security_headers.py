"""The browser-level defences, asserted where they can be read.

Three headers on this app blocked the application's own images in development,
and all three fail silently:

    Cross-Origin-Resource-Policy: same-origin   -> ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
    img-src without the API origin              -> an <img> that renders nothing
    connect-src without the API origin          -> the API is unreachable

There is no server-side log line for any of them, and no exception. An avatar
that does not appear is indistinguishable from a missing avatar, so nothing gets
investigated until someone watches the network tab.

These tests read the policy rather than asserting exact strings. A test that
pins the whole header fails the next time a legitimate origin is added and gets
weakened or deleted; these assert the properties that matter -- that the origins
the development SPA runs on are present, and that the cross-origin protections
are still there.
"""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

# The ports a local run actually uses. Vite serves the SPA; Uvicorn serves the
# API and the uploads.
DEV_SERVER = ("http://localhost:5173", "http://127.0.0.1:5173")
API_ORIGIN = ("http://localhost:8000", "http://127.0.0.1:8000")


def _csp() -> str:
    return settings.CSP_POLICY


def _directive(policy: str, name: str) -> str:
    """The body of one directive, or '' if it is absent."""
    for part in policy.split(";"):
        tokens = part.split()
        if tokens and tokens[0] == name:
            return " ".join(tokens[1:])
    return ""


def test_csp_allows_the_dev_origins_the_app_needs():
    img_src = _directive(_csp(), "img-src")
    assert img_src, "img-src is missing entirely; every image would be blocked"
    # Only the API origin. Nothing is loaded from Vite -- it serves the SPA's own
    # code, which `script-src 'self'` covers because the page itself is 'self'.
    for origin in API_ORIGIN:
        assert origin in img_src, (
            f"{origin} is not in img-src, so profile photos, logos and uploads "
            f"render as nothing. Present: {img_src!r}"
        )

    connect_src = _directive(_csp(), "connect-src")
    assert connect_src, "connect-src is missing entirely; the API would be unreachable"
    for origin in DEV_SERVER + API_ORIGIN:
        assert origin in connect_src, (
            f"{origin} is not in connect-src, so the API and the WebSocket are "
            f"blocked from the dev server. Present: {connect_src!r}"
        )


def test_csp_keeps_its_hardening():
    policy = _csp()
    # A CSP loosened until it stops protecting anything is the usual way these
    # get "fixed". These four are the ones with a real attack behind them.
    assert "'none'" in _directive(policy, "frame-ancestors"), (
        "frame-ancestors lost 'none': clickjacking is possible again"
    )
    assert "default-src 'self'" in policy, "default-src no longer denies by default"
    assert "'unsafe-inline'" not in _directive(policy, "script-src"), (
        "script-src allows inline scripts; the CSP no longer blocks most XSS"
    )
    assert _directive(policy, "base-uri") == "'self'", (
        "base-uri is unrestricted, so a base tag can rewrite every relative URL"
    )


def test_cross_origin_resource_policy_is_not_same_origin_in_development():
    """The header that blocked every avatar.

    In development the SPA and the API are different origins by port. `same-origin`
    on an image is a browser-enforced refusal with no server-side error, and it
    applies to avatars, logos and uploads -- everything the user sees of their
    own data.

    `same-site` keeps the protection that matters (another site cannot read a
    user's images) and allows localhost:5173 to load localhost:8000.
    """
    client = TestClient(app)
    response = client.get("/health")
    corp = response.headers.get("Cross-Origin-Resource-Policy")
    assert corp, "CORP header is missing entirely"

    if settings.ENVIRONMENT == "production":
        assert corp == "same-origin"
    else:
        assert corp != "same-origin", (
            "CORP is same-origin in a development environment, which blocks "
            "every image served from the API port"
        )
        assert corp == "same-site"


def test_the_headers_are_actually_on_the_response():
    """Not the configuration -- the response.

    A policy that is correct in `config` and absent from the middleware is a
    policy that protects nothing, and reading the config would not notice.
    """
    client = TestClient(app)
    response = client.get("/health")
    for header in (
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Content-Security-Policy",
        "Cross-Origin-Opener-Policy",
    ):
        assert response.headers.get(header), f"{header} is not on the response"