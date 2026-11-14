"""Account lockout after repeated failed logins.

The counter state now lives outside the process, in the shared sliding window
from `app.core.limiter`. The previous in-process dict meant a four-replica
deployment tolerated four times the intended number of attempts, and every
restart wiped the history — so an attacker simply waited for a deploy.

Both axes are checked, which is what defeats the two obvious attacks against a
lockout scheme:

* per-username only — an attacker sprays one password across many accounts, or
  locks every user out at once, which is a denial of service on the whole salon;
* per-IP only — one host behind a rotating address defeats it outright.

Checking `user:<name>` and `ip:<address>` together means neither rotation is
free, and neither axis can be used to lock the other out.

Model
-----
Failures are a sliding window of `ACCOUNT_LOCKOUT_WINDOW_SECONDS`. Reaching the
threshold starts a lockout for `ACCOUNT_LOCKOUT_DURATION_MINUTES`, measured from
when the events age out of the window. Deliberate properties:

* `is_locked` is read-only. It must not record a failure, or a client polling
  the login form would lock itself out by asking.
* Further attempts during a lockout do not extend it. Otherwise an attacker
  could hold an account locked indefinitely by hammering it.
* A successful login clears the history. Otherwise five scattered typos across
  a day would accumulate into a lockout, since the counter only has to add up,
  it does not have to be consecutive.
"""

from __future__ import annotations

from app.core import limiter


class AccountLockout:
    """Failure counting and lockout with the state held outside the process."""

    def __init__(
        self,
        threshold: int,
        window_seconds: int,
        lockout_seconds: int,
    ) -> None:
        self.threshold = threshold
        self.window_seconds = window_seconds
        self.lockout_seconds = lockout_seconds

    # -- identity ----------------------------------------------------------

    @staticmethod
    def username_key(username: str) -> str:
        return f"user:{username.strip().lower()}"

    @staticmethod
    def ip_key(client_ip: str) -> str:
        return f"ip:{client_ip.strip() or 'unknown'}"

    @classmethod
    def _key(cls, identifier: str) -> str:
        """Normalises an identifier into a namespaced key.

        Accepts either a bare username or an already-prefixed key, so callers
        that check both axes can pass either form.
        """
        if identifier.startswith(("user:", "ip:")):
            return identifier
        return cls.username_key(identifier)

    # -- checks ------------------------------------------------------------

    def is_locked(self, identifier: str) -> tuple[bool, int]:
        """Returns (is_locked, retry_after_seconds). Records nothing.

        The lock lifts once the failure window has emptied, which is why the
        wait is measured from the oldest live event: a user who trips the
        threshold at 14:59:30 waits the remainder of that window, not a fresh
        full cooldown starting from the check.
        """
        count, wait = limiter.inspect(
            self._key(identifier),
            window_seconds=self.window_seconds,
            nth=1,
            namespace=limiter.NS_LOCKOUT,
        )
        if count < self.threshold:
            return False, 0
        return True, max(wait, 1)

    def record_failure(self, identifier: str) -> tuple[bool, int]:
        """Counts a failure. Returns (now_locked, retry_after_seconds)."""
        key = self._key(identifier)
        retry_after = limiter.hit(
            key,
            max_requests=self.threshold,
            window_seconds=self.window_seconds,
            namespace=limiter.NS_LOCKOUT,
        )
        if retry_after is None:
            return False, 0
        return True, self.lockout_seconds

    def record_success(self, identifier: str) -> None:
        """Clears the failure history after a successful login."""
        limiter.clear(self._key(identifier), namespace=limiter.NS_LOCKOUT)


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


def reset_instance() -> None:
    """Used by the test suite to pick up changed settings."""
    global _instance
    _instance = None
