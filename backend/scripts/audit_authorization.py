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
import os
import sys
from collections import Counter
from pathlib import Path

# Run as `python scripts/audit_authorization.py` from anywhere, exactly like the
# other scripts here. The backend root has to be on the path before `app` is
# importable, and it is not when the script is invoked by its own path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ENVIRONMENT", "development")
# Must satisfy the 32-character minimum in `Settings`, and must not be the
# production placeholder the config guards against.
os.environ.setdefault("SECRET_KEY", "audit-only-not-a-real-secret-0123456789abcdef")
os.environ.setdefault("DATABASE_URL", "sqlite:///./audit-authorization.db")

from fastapi import FastAPI  # noqa: E402
from fastapi.routing import APIRoute  # noqa: E402

from app.main import app  # noqa: E402

MUTATING = {"POST", "PUT", "PATCH", "DELETE"}

# Routes that are meant to be reachable without a session. Each one is a
# deliberate product decision, so they are named here to be reviewed as a list
# rather than discovered as a gap.
EXPECTED_PUBLIC = {
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/refresh"),
    ("POST", "/api/v1/auth/totp/verify"),
    ("POST", "/api/v1/public/member/register"),
    ("POST", "/api/v1/public/member/login"),
    ("POST", "/api/v1/public/booking"),
    ("POST", "/api/v1/public/booking/availability"),
    ("GET", "/health"),
    ("GET", "/api/v1/health/live"),
    ("GET", "/api/v1/health/ready"),
    ("GET", "/api/v1/meta"),
    ("GET", "/docs"),
    ("GET", "/redoc"),
    ("GET", "/openapi.json"),
}


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
            key = (method, path)
            if key in EXPECTED_PUBLIC:
                kind = "PUBLIC"
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
    for kind in ("UNPROTECTED", "MUTATING_NO_ROLE", "NO_ROLE_CHECK", "PUBLIC", "OK"):
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
    for kind in ("UNPROTECTED", "MUTATING_NO_ROLE", "NO_ROLE_CHECK", "PUBLIC", "OK"):
        if kind in counts:
            print(f"  {kind:18} {counts[kind]}")

    blocking = counts.get("UNPROTECTED", 0) + counts.get("MUTATING_NO_ROLE", 0)
    print(f"\nRoutes that need a decision: {blocking}")
    return 0 if blocking == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
