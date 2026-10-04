"""Request rate limiting.

Thin policy layer over `app.core.limiter`. Two things live here and nowhere
else, because getting either wrong silently removes the protection:

* how a client is identified, and
* what happens when the quota is exceeded.

The counter itself is shared (Redis) when configured, so the limit means the
same thing on every replica.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, Request, status

from app.core import limiter

logger = logging.getLogger(__name__)

# Peers that never appear in real traffic but do in tests and in the local
# dev proxy chain. They are *not* trusted implicitly — see `client_identifier`.
_LOCAL_PEERS = frozenset({"127.0.0.1", "::1", "localhost", "testclient"})


def _trusted_proxies() -> frozenset[str]:
    from app.core.config import settings

    return frozenset(settings.TRUSTED_PROXY_IPS or ())


def _normalise(address: str | None) -> str:
    return (address or "").strip()


def client_identifier(request: Request) -> str:
    """Best available identity for the caller.

    Forwarding headers are only believed when the immediate peer is an
    explicitly configured proxy. This is the security-relevant decision in the
    whole module, and the previous version got it backwards: it trusted
    `X-Forwarded-For` from *any* localhost peer. Anything that can reach the
    app from the loopback interface — a local process, an SSRF through another
    service, a compromised co-tenant — could therefore assert an arbitrary
    address and mint itself a fresh quota on every request, which defeats the
    limiter completely.

    With no proxy configured, which is the default, the socket peer is used and
    the headers are ignored entirely.
    """
    peer = _normalise(request.client.host if request.client else None) or "unknown"

    if peer not in _trusted_proxies():
        return peer

    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # The left-most entry is the original client as recorded by the edge.
        client = _normalise(forwarded_for.split(",")[0])
        if client:
            return client

    real_ip = _normalise(request.headers.get("x-real-ip"))
    if real_ip:
        return real_ip

    return peer


def rate_limit(key: str, *, max_requests: int, window_seconds: int):
    """FastAPI dependency enforcing a per-client sliding-window quota.

    `key` namespaces the bucket, so the login limiter and the public-booking
    limiter never share a quota even when they use the same numbers.
    """

    async def dependency(request: Request) -> None:
        bucket = f"{key}:{client_identifier(request)}"
        retry_after = limiter.hit(
            bucket,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="تم تجاوز عدد الطلبات المسموح، حاول مرة أخرى بعد قليل",
                headers={"Retry-After": str(retry_after)},
            )

    # Named after the bucket, for the same reason `require_roles` names its
    # closure: the authorisation audit reads dependency names, and an unnamed
    # closure is called `dependency` by every one of them, so a throttled route
    # and an unprotected one are indistinguishable in its report. The name is
    # deliberately not an auth marker, because a quota is not an identity --
    # `AUTH_MARKERS` does not match it, and a rate-limited public endpoint still
    # has to be registered as deliberately public.
    dependency.__name__ = f"rate_limit[{key}]"
    dependency.__qualname__ = dependency.__name__

    return dependency


def rate_limit_for_credentials(username: str) -> int | None:
    """Quota check for login attempts that carry a username.

    Login is throttled on two axes — the source address and the target account
    — because either alone is trivially evaded: rotating addresses defeats a
    per-IP limit, and distributing an attack across many usernames defeats a
    per-account limit. Checking both means neither rotation is free.
    """
    from app.core.config import settings

    return limiter.hit(
        f"login-username:{username.lower()}",
        max_requests=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
        window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
    )
