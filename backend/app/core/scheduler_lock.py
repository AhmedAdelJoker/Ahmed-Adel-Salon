"""Distributed lock for scheduled jobs.

The problem
-----------
`BackgroundScheduler` was started at *module import* and every job ran wherever
that process happened to be. Two consequences, both invisible until the app was
deployed with more than one worker:

* **Every replica ran every job.** Four workers meant four automatic POS-shift
  closures, four WhatsApp report deliveries — the same customer could be sent
  the same financial summary four times in one tick — and four concurrent
  writers on the same rows. `max_instances=1` does not help: it bounds
  concurrency *within* one scheduler, not across processes.
* **Importing the module started the scheduler.** `conftest.py`, `e2e_server.py`
  and any ad-hoc script that imported `app.main` began firing background jobs
  against whatever database the environment happened to point at.

The fix
-------
`BackgroundScheduler` stays, because it is a good fit for *interval* work and
costs nothing. What changes is that each job body now runs under a Redis
advisory lock, so across N replicas exactly one runs it per tick and the rest
skip. Whichever worker wins differs from tick to tick, which is fine: the jobs
are idempotent reads-and-writes keyed on due records, not leader-scoped work.

`SET key token NX PX ttl` is the acquire. The token is random and the release
is a compare-and-delete script, because a job that overruns its TTL must not
delete the lock the *next* worker now holds — that would let two workers run
the same job concurrently, which is the failure this whole module exists to
prevent.

The TTL is a safety net, not the primary mechanism: it bounds how long a crashed
worker's jobs stay stalled, at the cost of a slightly late run. It is therefore
set comfortably above the slowest job, not tuned to the tick interval.
"""

from __future__ import annotations

import logging
import secrets
import threading
from contextlib import contextmanager
from typing import Iterator

from app.core import limiter

logger = logging.getLogger(__name__)

NS = "salonpro:joblock"

# Releases the lock only if we still hold it. Without the compare, a job that
# overran its TTL would delete the successor's lock and let both run at once.
_LUA_RELEASE = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
"""


# Fallback for a deployment without Redis: a process-local lock. Correct for a
# single process, and honestly labelled — it is not a substitute for Redis once
# there is more than one worker, which is why `backend_name()` is reported.
_local_locks: dict[str, threading.Lock] = {}
_local_registry_lock = threading.Lock()


def _local_lock(name: str) -> threading.Lock:
    with _local_registry_lock:
        lock = _local_locks.get(name)
        if lock is None:
            lock = threading.Lock()
            _local_locks[name] = lock
        return lock


@contextmanager
def job_lock(name: str, *, ttl_seconds: int = 900) -> Iterator[bool]:
    """Runs the block only if this process wins the lock.

    Yields True when the lock was acquired and False when another worker holds
    it. Callers should return quietly on False: skipping is the normal case
    with more than one replica, not an error.

    `ttl_seconds` must exceed the job's worst-case runtime. It is the recovery
    path for a worker that dies mid-job, so it is deliberately generous: too
    short and two workers overlap, too long and a crash stalls the job.
    """
    client = limiter._client()
    key = f"{NS}:{name}"
    token = secrets.token_urlsafe(16)

    if client is not None:
        acquired = False
        try:
            acquired = bool(client.set(key, token, nx=True, px=ttl_seconds * 1000))
        except Exception as exc:  # pragma: no cover - depends on the environment
            logger.error("Job lock unavailable (%s); using process-local lock", exc)
        else:
            if not acquired:
                logger.debug("[Scheduler] %s is held by another worker; skipping", name)
                yield False
                return
            try:
                yield True
            finally:
                try:
                    client.eval(_LUA_RELEASE, 1, key, token)
                except Exception as exc:  # pragma: no cover
                    logger.error("Failed to release job lock %s: %s", name, exc)
            return

    # Process-local fallback.
    lock = _local_lock(name)
    if not lock.acquire(blocking=False):
        logger.debug("[Scheduler] %s is already running here; skipping", name)
        yield False
        return
    try:
        yield True
    finally:
        lock.release()


def backend_name() -> str:
    """'redis' or 'local'. Surfaced by the health endpoint."""
    return "redis" if limiter._client() is not None else "local"


def reset_local_locks() -> None:
    """Used by the test suite."""
    with _local_registry_lock:
        _local_locks.clear()
