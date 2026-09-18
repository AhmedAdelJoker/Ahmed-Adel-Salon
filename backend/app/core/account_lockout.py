"""
Account Lockout — phase 3 security hardening.

Tracks failed login attempts per username and IP, and locks the account
out for a configurable duration after the threshold is exceeded.

This is an in-memory implementation suitable for single-instance deployments
and tests. For multi-replica production deployments, swap this for a Redis
backend (interface is intentionally minimal).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
from time import monotonic


@dataclass
class _Entry:
    """Per-identifier lockout state."""
    failed_attempts: list[float] = field(default_factory=list)
    locked_until: float | None = None


class AccountLockout:
    def __init__(
        self,
        threshold: int,
        window_seconds: int,
        lockout_seconds: int,
    ) -> None:
        self.threshold = threshold
        self.window_seconds = window_seconds
        self.lockout_seconds = lockout_seconds
        self._state: dict[str, _Entry] = {}
        self._lock = Lock()

    def _now(self) -> float:
        return monotonic()

    def is_locked(self, identifier: str) -> tuple[bool, int]:
        """
        Check whether the identifier is currently locked out.
        Returns (is_locked, retry_after_seconds).
        """
        now = self._now()
        with self._lock:
            entry = self._state.get(identifier)
            if not entry or entry.locked_until is None:
                return False, 0
            if now >= entry.locked_until:
                # Lock has expired — clear it
                entry.locked_until = None
                entry.failed_attempts.clear()
                return False, 0
            return True, int(entry.locked_until - now)

    def record_failure(self, identifier: str) -> tuple[bool, int]:
        """
        Record a failed login attempt. Returns (now_locked, retry_after_seconds).
        """
        now = self._now()
        with self._lock:
            entry = self._state.setdefault(identifier, _Entry())
            # Drop failures outside the sliding window
            entry.failed_attempts = [
                t for t in entry.failed_attempts if now - t < self.window_seconds
            ]
            entry.failed_attempts.append(now)

            if len(entry.failed_attempts) >= self.threshold:
                entry.locked_until = now + self.lockout_seconds
                return True, self.lockout_seconds

        return False, 0

    def record_success(self, identifier: str) -> None:
        """Reset the failure counter on successful login."""
        with self._lock:
            entry = self._state.get(identifier)
            if entry:
                entry.failed_attempts.clear()
                entry.locked_until = None


# Module-level singleton — configured from settings on first use
_instance: AccountLockout | None = None


def get_lockout() -> AccountLockout:
    global _instance
    if _instance is None:
        from app.core.config import settings
        _instance = AccountLockout(
            threshold=settings.ACCOUNT_LOCKOUT_THRESHOLD,
            window_seconds=settings.ACCOUNT_LOCKOUT_WINDOW_SECONDS,
            lockout_seconds=settings.ACCOUNT_LOCKOUT_DURATION_MINUTES * 60,
        )
    return _instance
