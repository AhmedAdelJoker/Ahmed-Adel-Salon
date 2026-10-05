"""Shared rate-limit and lockout state.

The problem this solves
-----------------------
Both the rate limiter and the account lockout used to keep their counters in a
module-level dict. That is fine for one process and wrong for several:

* counters are invisible to every other worker, so a deployment with N replicas
  grants N times the intended quota — a brute-force attempt loop is free;
* counters reset on every restart, and on every deploy;
* each worker keeps its own copy, so an attacker whose requests spread across
  replicas is never throttled at all;
* nothing is bounded, so rotating the source address (trivial over IPv6, where
  one host owns a whole /64) grows the heap until the worker is OOM-killed.

Redis makes the state shared, so the limits mean the same thing on every
replica. When Redis is absent the limiter falls back to bounded in-process
memory: weaker, honestly so, but never fatal. A salon POS that refuses to start
because its cache is unreachable is worse than one running with per-process
throttles, so this never fails closed.

Algorithm
---------
A sliding-window log, not a fixed window. Fixed windows let a caller send
`max` requests at the end of one window and `max` at the start of the next, so
the effective rate is double the configured limit on every boundary. The log
keeps per-request timestamps in a sorted set and trims what has aged out.

Redis executes the whole thing as a Lua script, which is atomic by definition.
Doing the trim, the count and the insert as separate round-trips would leave a
window in which two concurrent requests both observe a free slot — the exact
race the previous read-then-write design had.
"""

from __future__ import annotations

import logging
import secrets
import threading
from collections import OrderedDict
from math import ceil
from time import monotonic

logger = logging.getLogger(__name__)

# Key namespaces. The prefix keeps limiter state separable from anything else
# living in the same Redis instance.
NS_RATE_LIMIT = "salonpro:rl"
NS_LOCKOUT = "salonpro:lockout"

# Sliding-window log. Returns {allowed, retry_after_seconds, count}.
#
#   KEYS[1] the sorted set holding the timestamps
#   ARGV[1] now, milliseconds
#   ARGV[2] window length, milliseconds
#   ARGV[3] maximum allowed events in the window
#
# Members are "<now>-<random>" so that two requests inside the same
# millisecond do not collide on the sorted-set score and silently overwrite
# each other, which would under-count the window.
_LUA_SLIDING_WINDOW = """
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local window   = tonumber(ARGV[2])
local max      = tonumber(ARGV[3])
local member   = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then
    retry = (tonumber(oldest[2]) + window) - now
    if retry < 0 then retry = 0 end
  end
  redis.call('PEXPIRE', key, window)
  return {0, retry, count}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, 0, count + 1}
"""

# Read-only window inspection. Records nothing, so it is safe to call on every
# request: a "check whether locked" that itself counted a failure would make
# the lockout trigger faster the more often it was checked, and would let a
# client walk itself into a lockout purely by polling.
#
# Returns {count, milliseconds_until_the_count_th_event_ages_out}.
_LUA_INSPECT = """
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local wanted = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < wanted then
  return {count, 0}
end

-- The lock releases once enough of the oldest events have aged out, so the
-- wait is measured from the event that is `wanted`-th most recent.
local entry = redis.call('ZRANGE', key, 0, wanted - 1, 'REV WITHSCORES')
local score = entry[2]
if not score then
  return {count, 0}
end
local wait = (tonumber(score) + window) - now
if wait < 0 then wait = 0 end
return {count, wait}
"""

# Removes every event for a key. Used to clear a failure history after a
# successful login, so that five scattered typos across a day cannot
# accumulate into a lockout.
_LUA_CLEAR = """
redis.call('DEL', KEYS[1])
return 1
"""


# --------------------------------------------------------------------------- #
# In-memory fallback
# --------------------------------------------------------------------------- #


class MemorySlidingWindow:
    """Bounded sliding-window log, used when Redis is unavailable.

    `max_tracked_keys` is the important part. The unbounded dict this replaces
    was a denial-of-service primitive: every distinct source address added a
    key that was never reclaimed, and IPv6 makes unbounded addresses free.
    Eviction is least-recently-used, so a long-running server under load has a
    flat ceiling on memory instead of a slope.
    """

    def __init__(self, max_tracked_keys: int = 20_000) -> None:
        self._events: OrderedDict[str, list[float]] = OrderedDict()
        self._lock = threading.Lock()
        self._max_keys = max(1, max_tracked_keys)

    def hit(self, key: str, *, max_requests: int, window_seconds: int) -> int | None:
        now = monotonic()
        with self._lock:
            events = self._events.get(key)
            if events is None:
                events = []
                self._events[key] = events
            else:
                # Refresh recency for the LRU ordering.
                self._events.move_to_end(key)

            cutoff = now - window_seconds
            if events and events[0] <= cutoff:
                events = [t for t in events if t > cutoff]
                self._events[key] = events

            if len(events) >= max_requests:
                retry_after = max(window_seconds - (now - events[0]), 1)
                return ceil(retry_after)

            events.append(now)
            self._evict_if_needed()
            return None

    def inspect(
        self, key: str, *, window_seconds: int, nth: int
    ) -> tuple[int, int]:
        """Read-only. Returns (count in window, seconds until the nth-newest
        event ages out). Records nothing, so it is safe on the request path."""
        now = monotonic()
        with self._lock:
            events = self._events.get(key)
            if not events:
                return 0, 0
            cutoff = now - window_seconds
            live = [t for t in events if t > cutoff]
            if len(live) != len(events):
                self._events[key] = live
                events = live
            if len(events) < nth:
                return len(events), 0
            target = events[len(events) - nth]
            return len(events), max(ceil(window_seconds - (now - target)), 0)

    def clear(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def _evict_if_needed(self) -> None:
        if len(self._events) <= self._max_keys:
            return
        # Drop the coldest quarter in one pass, so this is amortised O(1)
        # rather than running on every single insert.
        for _ in range(max(1, self._max_keys // 4)):
            if len(self._events) <= self._max_keys:
                break
            self._events.popitem(last=False)

    def clear_all(self) -> None:
        with self._lock:
            self._events.clear()

    def tracked_keys(self) -> int:
        with self._lock:
            return len(self._events)


# --------------------------------------------------------------------------- #
# Redis backend
# --------------------------------------------------------------------------- #


class RedisSlidingWindow:
    """Sliding-window log held in Redis, shared by every replica."""

    def __init__(self, client, namespace: str = NS_RATE_LIMIT) -> None:
        self._redis = client
        self._namespace = namespace
        self._script = client.register_script(_LUA_SLIDING_WINDOW)
        self._inspect_script = client.register_script(_LUA_INSPECT)
        self._clear_script = client.register_script(_LUA_CLEAR)

    def hit(self, key: str, *, max_requests: int, window_seconds: int) -> int | None:
        now_ms = int(monotonic() * 1000)
        # The member id must be unique per request or the sliding window would
        # treat retries as one hit. `secrets` rather than `random` because this
        # file is security-adjacent and a reviewer is right to ask why a
        # predictable value is being generated inside the rate limiter; the cost
        # of the better answer is a few microseconds against a Redis round trip.
        member = f"{now_ms}-{secrets.token_hex(8)}"
        allowed, retry_ms, _count = self._script(
            keys=[f"{self._namespace}:{key}"],
            args=[now_ms, window_seconds * 1000, max_requests, member],
        )
        if int(allowed) == 1:
            return None
        return max(ceil(int(retry_ms) / 1000), 1)

    def inspect(
        self, key: str, *, window_seconds: int, nth: int
    ) -> tuple[int, int]:
        now_ms = int(monotonic() * 1000)
        count, wait_ms = self._inspect_script(
            keys=[f"{self._namespace}:{key}"],
            args=[now_ms, window_seconds * 1000, nth],
        )
        return int(count), ceil(int(wait_ms) / 1000)

    def clear(self, key: str) -> None:
        self._clear_script(keys=[f"{self._namespace}:{key}"])

    def clear_all(self) -> None:  # pragma: no cover - requires a live Redis
        for key in self._redis.scan_iter(f"{self._namespace}:*"):
            self._redis.delete(key)


# --------------------------------------------------------------------------- #
# Selection
# --------------------------------------------------------------------------- #


def _build_redis():
    """Returns a Redis client, or None when Redis is not configured.

    `redis` is an optional dependency. Importing it lazily means the desktop
    build, the test suite and any single-instance install keep working without
    it installed, which is what makes the fallback a real fallback rather than
    a configuration trap.
    """
    from app.core.config import settings

    url = (settings.REDIS_URL or "").strip()
    if not url:
        return None

    try:
        import redis  # type: ignore[import-untyped]
    except ImportError:
        logger.error(
            "REDIS_URL is set but the 'redis' package is not installed. "
            "Falling back to per-process limits, which are not shared between "
            "workers. Install it with: pip install redis"
        )
        return None

    try:
        client = redis.Redis.from_url(
            url,
            socket_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_connect_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS,
            decode_responses=False,
        )
        client.ping()
    except Exception as exc:  # pragma: no cover - depends on the environment
        logger.error("Redis is unreachable (%s); falling back to per-process limits", exc)
        return None

    return client


_redis_client = None
_redis_checked = False
_backend_lock = threading.Lock()


def _client():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    with _backend_lock:
        if not _redis_checked:
            _redis_client = _build_redis()
            _redis_checked = True
            if _redis_client is None:
                from app.core.config import settings

                if (settings.REDIS_URL or "").strip():
                    logger.warning(
                        "Rate limiting is running in per-process mode. With more "
                        "than one worker, set REDIS_URL to a reachable instance "
                        "or every worker enforces its own quota."
                    )
    return _redis_client


def reset_backend_cache() -> None:
    """Forces the next call to re-probe Redis. Used by the test suite."""
    global _redis_client, _redis_checked
    with _backend_lock:
        _redis_client = None
        _redis_checked = False


def _max_tracked_keys() -> int:
    from app.core.config import settings

    return settings.RATE_LIMIT_MAX_TRACKED_KEYS


_rate_limit_memory: MemorySlidingWindow | None = None
_lockout_memory: MemorySlidingWindow | None = None


def _memory_for(namespace: str) -> MemorySlidingWindow:
    global _rate_limit_memory, _lockout_memory
    if namespace == NS_LOCKOUT:
        if _lockout_memory is None:
            _lockout_memory = MemorySlidingWindow(_max_tracked_keys())
        return _lockout_memory
    if _rate_limit_memory is None:
        _rate_limit_memory = MemorySlidingWindow(_max_tracked_keys())
    return _rate_limit_memory


def hit(
    key: str,
    *,
    max_requests: int,
    window_seconds: int,
    namespace: str = NS_RATE_LIMIT,
) -> int | None:
    """Records one event against `key`.

    Returns the number of seconds the caller should wait, or None when the
    event is within quota.

    Falls back to bounded in-process memory if Redis is unreachable, so a cache
    outage degrades the protection instead of removing the endpoint.
    """
    client = _client()
    if client is not None:
        try:
            return RedisSlidingWindow(client, namespace).hit(
                key, max_requests=max_requests, window_seconds=window_seconds
            )
        except Exception as exc:  # pragma: no cover - depends on the environment
            logger.error("Redis limiter failed (%s); using per-process limits", exc)
    return _memory_for(namespace).hit(
        key, max_requests=max_requests, window_seconds=window_seconds
    )


def inspect(
    key: str,
    *,
    window_seconds: int,
    nth: int,
    namespace: str = NS_RATE_LIMIT,
) -> tuple[int, int]:
    """Read-only. Returns (events in window, seconds until the nth-newest ages out).

    Must not record anything: it runs on the request path, and a check that
    counted a failure would make the caller trigger its own lockout by asking.
    """
    client = _client()
    if client is not None:
        try:
            return RedisSlidingWindow(client, namespace).inspect(
                key, window_seconds=window_seconds, nth=nth
            )
        except Exception as exc:  # pragma: no cover - depends on the environment
            logger.error("Redis limiter inspect failed (%s); using local state", exc)
    return _memory_for(namespace).inspect(
        key, window_seconds=window_seconds, nth=nth
    )


def clear(key: str, *, namespace: str = NS_RATE_LIMIT) -> None:
    """Drops the recorded history for a key."""
    client = _client()
    if client is not None:
        try:
            RedisSlidingWindow(client, namespace).clear(key)
            return
        except Exception as exc:  # pragma: no cover - depends on the environment
            logger.error("Redis limiter clear failed (%s); using local state", exc)
    _memory_for(namespace).clear(key)


def reset_memory() -> None:
    """Clears the in-process fallback. Used by the test suite."""
    global _rate_limit_memory, _lockout_memory
    _rate_limit_memory = None
    _lockout_memory = None


def backend_name() -> str:
    """'redis' or 'memory'. Surfaced by the health endpoint."""
    return "redis" if _client() is not None else "memory"
