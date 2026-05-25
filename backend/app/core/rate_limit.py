from __future__ import annotations

from collections import defaultdict, deque
from math import ceil
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, *, max_requests: int, window_seconds: int) -> int | None:
        now = monotonic()

        with self._lock:
            events = self._events[key]
            while events and now - events[0] >= window_seconds:
                events.popleft()

            if len(events) >= max_requests:
                retry_after = max(window_seconds - (now - events[0]), 1)
                return ceil(retry_after)

            events.append(now)
            return None


limiter = InMemoryRateLimiter()


def _client_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_hop = forwarded_for.split(",")[0].strip()
        if first_hop:
            return first_hop

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def rate_limit(key: str, *, max_requests: int, window_seconds: int):
    async def dependency(request: Request) -> None:
        bucket = f"{key}:{_client_identifier(request)}"
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

    return dependency
