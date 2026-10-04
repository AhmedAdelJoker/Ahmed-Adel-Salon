"""Authorisation audit: which routes require authentication, and which require a role.

A missing `require_roles` on a mutating endpoint is a total compromise of that
resource for anybody who can log in, and it is invisible in review because the
endpoint looks exactly like its neighbours. Nothing else in the test suite finds
it: the tests that exercise an endpoint use an admin token, so they pass whether
or not the check is there, and a test that omits the check is not a test.

So this walks the actual router tree rather than the source, because the router
tree is what enforces. A decorator that is commented out, applied to the wrong
object, or shadowed by a same-named function shows up here and nowhere else.

Reports four classes per route:

    UNPROTECTED      no authentication dependency at all
    NO_ROLE_CHECK    authenticated, but no role requirement
    MUTATING_NO_ROLE  POST/PUT/PATCH/DELETE with no role requirement
    PUBLIC           explicitly unauthenticated, listed so it is a decision
                     rather than an oversight

Usage:
    python scripts/audit_authorization.py            # report
    python scripts/audit_authorization.py --json     # machine readable
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

# The mount prefix `include_router` puts on every versioned route. Stripped from
# both sides of every comparison below; see `canonical`.
API_PREFIX_RE = re.compile(r"^/api/v\d+")

# Run as `python scripts/audit_authorization.py` from anywhere, exactly like the
# other scripts here. The backend root has to be on the path before `app` is
# importable, and it is not when the script is invoked by its own path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# The settings this needs to import the application with nothing behind it live
# in one place, `backend/stub_env.py`, because the list used to be hand-copied
# here and this copy was the one that drifted: it omitted
# `FIRST_SUPERUSER_PASSWORD`, so the `security-sast` job failed in a step named
# "Authorisation audit". `tests/test_stub_env.py` pins the list against
# `Settings` so the next required field fails a local test run instead.
from stub_env import provision

provision({"DATABASE_URL": "sqlite:///./audit-authorization.db"})

from fastapi import FastAPI  # noqa: E402
from fastapi.routing import APIRoute  # noqa: E402

from app.main import app  # noqa: E402

MUTATING = {"POST", "PUT", "PATCH", "DELETE"}

# Routes that are meant to be reachable without a session. Each one is a
# deliberate product decision, so they are named here to be reviewed as a list
# rather than discovered as a gap.
EXPECTED_PUBLIC_RAW = {
    # --- authentication, which cannot authenticate anyone -------------------
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/refresh"),
    # --- the public booking site --------------------------------------------
    ("POST", "/api/v1/public/booking"),
    ("GET", "/api/v1/public/booking-catalog"),
    ("GET", "/api/v1/public/time-slots"),
    # The slug is the capability. There is no session to check, and that is the
    # design: a customer who has the link can watch their own booking. The risk
    # here is slug entropy, not authentication, so it is noted rather than gated.
    ("GET", "/api/v1/public/realtime/booking/{slug}"),
    ("GET", "/api/v1/public/realtime/booking/{slug}/poll"),
    # --- member self-service on the public site ------------------------------
    ("POST", "/api/v1/public/member/register"),
    ("POST", "/api/v1/public/member/login"),
    # --- reviews deliberately written by the public site ---------------------
    ("GET", "/api/v1/reviews/public"),
    # Anyone can submit a review; nobody can rate a barber they did not visit
    # (`barber_id` is stripped from the payload, and the appointment branch binds
    # the review to the appointment's own customer and employee). What it needed
    # was a quota, not a login, so it has one -- see `create_review`.
    ("POST", "/api/v1/reviews"),
    # --- public marketing pages served from the database ---------------------
    ("GET", "/api/v1/seo/pages"),
    ("GET", "/api/v1/seo/pages/{slug}"),
    # --- the WhatsApp webhook ------------------------------------------------
    # Meta cannot hold a session, so this has to be unauthenticated at the
    # dependency level and is authenticated in the body instead:
    # `GET` compares `hub.verify_token` with `hmac.compare_digest`, and `POST`
    # verifies the `X-Hub-Signature-256` HMAC-SHA256 over the raw body and
    # returns 403 without it. This audit only inspects dependencies, so it
    # cannot see that, and would otherwise report a hole on every run.
    ("GET", "/api/v1/integrations/whatsapp/webhook"),
    ("POST", "/api/v1/integrations/whatsapp/webhook"),
    # --- liveness and the API surface itself ---------------------------------
    ("GET", "/"),
    ("GET", "/health"),
    ("GET", "/api/v1/health/ready"),
    ("GET", "/docs"),
    ("GET", "/redoc"),
    ("GET", "/openapi.json"),
}

# Routes this audit cannot see, listed so that their absence from the walk is a
# known limit rather than a silent one. FastAPI's documentation routes are plain
# `starlette.routes.Route`, not `APIRoute`, so `walk_routes` never yields them
# and no entry in `EXPECTED_PUBLIC` can ever match one. They are not a
# liability: `app/main.py` sets `docs_url`/`redoc_url`/`openapi_url` to None when
# the environment is production, so the schema is unreachable in a real
# deployment and exposed only in development, where it is the point.
#
# `tests/test_authorization_audit.py` exempts exactly these three from the
# stale-entry check for that reason. If the app ever mounts them as APIRoutes,
# the exemption should go with it.
NOT_WALKABLE = frozenset({("GET", "/docs"), ("GET", "/redoc"), ("GET", "/openapi.json")})

# Mutations that authenticate the caller but need no role check, because they
# can only ever act on the caller's own account: their own profile, their own
# password, their own second factor, their own session, their own preferences.
#
# These are registered rather than exempted. The distinction that matters is
# between "authenticate" and "may touch someone else's data": the first is
# enough for this list, and a role check here would be cargo cult. Registering
# them keeps the gate honest in both directions -- a new self-service endpoint
# has to be added deliberately, and a route that stops being self-service (by
# gaining a body that reaches into another employee's record) no longer matches.
EXPECTED_SELF_SERVICE_RAW = {
    ("POST", "/api/v1/auth/2fa/disable"),
    ("POST", "/api/v1/auth/2fa/enable"),
    ("POST", "/api/v1/auth/2fa/setup"),
    ("POST", "/api/v1/auth/change-password"),
    ("POST", "/api/v1/auth/logout"),
    ("PUT", "/api/v1/preferences"),
    ("PUT", "/api/v1/profile"),
    ("POST", "/api/v1/profile/avatar"),
    ("POST", "/api/v1/profile/change-password"),
    ("POST", "/api/v1/public/member/logout"),
}


def canonical(path: str) -> str:
    """The path as this audit compares it, with the API version prefix removed.

    Both lists above are written in full mounted form (`/api/v1/auth/login`),
    because that is how a route reads in the OpenAPI document and in the
    frontend. `classify` sees the router-relative path (`/auth/login`). The two
    were compared literally, so every prefixed entry was dead and the six routes
    it claimed to whitelist were reported UNPROTECTED on every single run.

    The four entries that carried no prefix -- `/health`, `/docs`, `/redoc`,
    `/openapi.json` -- were the only ones that could ever match, and their
    absence from a report that listed `/health/ready` as unprotected is what
    gave the mismatch away. Both spellings are accepted from here on, so a route
    can be registered the way it is written in the app and compared either way.
    """
    stripped = API_PREFIX_RE.sub("", path or "")
    return stripped or "/"


EXPECTED_PUBLIC = {(method, canonical(path)) for method, path in EXPECTED_PUBLIC_RAW}
EXPECTED_SELF_SERVICE = {(method, canonical(path)) for method, path in EXPECTED_SELF_SERVICE_RAW}


def dependency_names(route: APIRoute) -> set[str]:
    """Every callable named in this route's dependency graph, transitively.

    Transitive on purpose: a route that guards itself with
    `dependencies=[Depends(require_roles(...))]` puts that on the router-level
    dependant, not the route's own signature, so a non-recursive walk reports it
    as unguarded.
    """
    found: set[str] = set()
    queue = list(getattr(route.dependant, "dependencies", []))
    seen: set[int] = set()
    while queue:
        dep = queue.pop()
        if id(dep) in seen:
            continue
        seen.add(id(dep))
        call = dep.call
        found.add(getattr(call, "__name__", None) or type(call).__name__)
        queue.extend(getattr(dep, "dependencies", []))
    return found


# Substrings that identify a dependency as an authentication or authorisation
# gate. Matched against the resolved callable's name, because that is the thing
# the framework actually calls.
#
# This started as `("current_user", "current_active_user")` and reported 20
# unprotected routes and 154 unguarded mutations, almost all of them false: member
# endpoints authenticate through `get_current_member` and staff-wide endpoints
# through `require_any_staff`, and neither name contains "current_user". A list
# of names is the only honest way to express this, and it has to be updated when
# a new gate is introduced -- which is why `deps` is printed in the report, so a
# missed name is visible rather than silent.
AUTH_MARKERS = (
    "current_user",
    "current_active_user",
    "current_member",
    "require_any_staff",
    "get_current",
    "require_auth",
    "verify_token",
)
ROLE_MARKERS = (
    "require_roles",
    "require_any_staff",
    "require_owner",
    "require_admin",
    "require_manager",
    "require_permission",
    "has_permission",
    "role",
    "forbidden_if",
)


def has_auth(names: set[str]) -> bool:
    return any(any(marker in name for marker in AUTH_MARKERS) for name in names)


def has_role_check(names: set[str]) -> bool:
    return any(name.startswith("require_") or any(m in name for m in ROLE_MARKERS) for name in names)


def child_routes(route) -> list | None:
    """The routes nested inside a wrapper, or None if it is a leaf.

    Three shapes have to be handled, and guessing wrong makes the audit silently
    pass:

    * a `Mount`, whose children are on `.routes` (empty for a `StaticFiles`
      mount, since those have no routes at all);
    * a plain `Mount`/`Router` with a sub-application, whose children are on
      `.app.routes`;
    * this FastAPI version's private `_IncludedRouter`, which `include_router`
      produces and which holds *no* route list of its own -- every endpoint in
      the application sits behind exactly one of these, on `original_router`.

    That last one is why a first version of this audit reported "1 route needs a
    decision" while the application has several hundred endpoints: it walked
    `app.routes`, saw thirteen wrapper entries, found two real routes, and
    reported success.
    """
    routes = getattr(route, "routes", None)
    if routes:
        return list(routes)
    original = getattr(route, "original_router", None)
    if original is not None and getattr(original, "routes", None):
        return list(original.routes)
    sub_app = getattr(route, "app", None)
    if sub_app is not None and getattr(sub_app, "routes", None):
        return list(sub_app.routes)
    return None


def walk_routes(routes, prefix: str = ""):
    """Yields `(prefix, APIRoute)` for every route, at any nesting depth."""
    for route in routes:
        sub = child_routes(route)
        if sub is not None:
            sub_prefix = prefix + (getattr(route, "path", "") or "")
            if not sub_prefix.startswith("/"):
                sub_prefix = "/" + sub_prefix
            yield from walk_routes(sub, sub_prefix)
            continue
        if isinstance(route, APIRoute):
            yield prefix, route


def classify(app: FastAPI) -> list[dict]:
    rows = []
    for prefix, route in walk_routes(app.routes):
        path = (prefix.rstrip("/") + route.path) if prefix else route.path
        if not path.startswith("/"):
            path = "/" + path
        methods = sorted(m for m in route.methods if m not in {"HEAD", "OPTIONS"})
        names = dependency_names(route)
        authenticated = has_auth(names)
        role_checked = has_role_check(names)
        for method in methods:
            key = (method, canonical(path))
            if key in EXPECTED_PUBLIC:
                kind = "PUBLIC"
            elif key in EXPECTED_SELF_SERVICE:
                kind = "SELF_SERVICE"
            elif not authenticated:
                kind = "UNPROTECTED"
            elif not role_checked:
                kind = "MUTATING_NO_ROLE" if method in MUTATING else "NO_ROLE_CHECK"
            else:
                kind = "OK"
            gates = sorted(
                n
                for n in names
                if n.startswith("require_")
                or "current" in n
                or "member" in n
                or "rate_limit" in n
                or "verify" in n
            )
            rows.append(
                {
                    "method": method,
                    "path": path,
                    "kind": kind,
                    "auth": authenticated,
                    "role": role_checked,
                    "deps": gates,
                }
            )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    rows = classify(app)
    counts = Counter(r["kind"] for r in rows)

    if args.json:
        print(json.dumps({"counts": dict(counts), "routes": rows}, indent=2))
        return 0

    print("Authorisation audit")
    print("=" * 72)
    for kind in ("UNPROTECTED", "MUTATING_NO_ROLE", "NO_ROLE_CHECK", "PUBLIC", "SELF_SERVICE", "OK"):
        group = [r for r in rows if r["kind"] == kind]
        if not group:
            continue
        print(f"\n{kind}  ({len(group)})")
        for row in sorted(group, key=lambda r: (r["path"], r["method"])):
            if kind == "OK":
                continue
            # The gates are printed so the classification can be checked rather
            # than trusted. A route listed as unprotected with a gate name that
            # obviously authenticates means this script's marker list is stale,
            # which is a far more likely explanation than an open hole.
            gates = ", ".join(row["deps"]) or "none"
            print(f"  {row['method']:6} {row['path']:52} [{gates}]")
    print("\n" + "=" * 72)
    for kind in ("UNPROTECTED", "MUTATING_NO_ROLE", "NO_ROLE_CHECK", "PUBLIC", "SELF_SERVICE", "OK"):
        if kind in counts:
            print(f"  {kind:18} {counts[kind]}")

    blocking = counts.get("UNPROTECTED", 0) + counts.get("MUTATING_NO_ROLE", 0)
    print(f"\nRoutes that need a decision: {blocking}")
    return 0 if blocking == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
