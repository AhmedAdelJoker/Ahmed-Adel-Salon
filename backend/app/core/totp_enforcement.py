"""Mandatory two-factor authentication for privileged roles.

The policy in one place, with no FastAPI or database dependency, because the
rules are fiddly and the interesting mistakes are all in the interactions:
grace-period arithmetic, roles that are removed from the list, and accounts
whose `created_at` is in the future because of a clock or a bad import.

The enforcement itself lives in the login endpoint; what this module decides is
only *what a given account is allowed to do right now*:

    EXEMPT        2FA is on, or the role is not privileged, or enforcement is off
    WARN          privileged, no 2FA, still inside the grace period: allowed, but
                  the caller is told to enrol
    BLOCK         privileged, no 2FA, grace expired: allowed a session only if the
                  role is not required to have 2FA at all

`BLOCK` is the whole point. An `owner` whose grace period has run out receives a
token that authenticates them and authorises nothing except enrolling, so the
blast radius of a stolen `owner` password before enrolment is a login screen
rather than the entire salon.

Measured from the first successful login rather than from `created_at`, because
`created_at` is set by a seed script or an import and can be months before the
account is ever used. Bricking an account on its first sign-in because of an old
timestamp is how "we will do 2FA next week" becomes an outage.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.roles import normalize_role

# Verdicts
EXEMPT = "exempt"
WARN = "warn"
BLOCK = "block"

# Claim embedded in the restricted token. Kept as a module constant because the
# login endpoint writes it and `deps_auth` reads it, and a string literal
# duplicated in two files is a string literal that will eventually differ.
ENROLLMENT_SCOPE = "2fa_enrollment"


@dataclass(frozen=True)
class Decision:
    """The outcome for one account, with the reason attached.

    The reason is not decoration: it goes into the audit log and the API
    response, and "why was this account allowed" is the first question anyone
    asks when a login behaves unexpectedly.
    """

    verdict: str
    reason: str
    deadline: datetime | None = None

    @property
    def blocks_full_session(self) -> bool:
        return self.verdict == BLOCK

    @property
    def should_prompt_enrollment(self) -> bool:
        return self.verdict in (WARN, BLOCK)


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalise to timezone-aware UTC.

    SQLite hands back naive datetimes and Postgres hands back aware ones for the
    same column, so this is not theoretical: comparing a naive `created_at` with
    an aware `utcnow()` raises, and the account that raises is the account that
    cannot log in.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def role_requires_2fa(role: str | None) -> bool:
    required = {normalize_role(r) for r in settings.TOTP_REQUIRED_ROLES}
    return normalize_role(role) in required


def enrollment_deadline(anchor: datetime | None) -> datetime | None:
    """When this account stops being allowed to defer enrolment.

    Matches `decide`, including the zero-day case where the answer is the anchor
    itself.
    """
    anchor_utc = _as_utc(anchor)
    if anchor_utc is None:
        return None
    return anchor_utc + timedelta(days=max(0, settings.TOTP_ENROLLMENT_GRACE_DAYS))


def decide(
    *,
    role: str | None,
    totp_enabled: bool,
    first_login_at: datetime | None,
    created_at: datetime | None,
    now: datetime | None = None,
) -> Decision:
    """Decides what this account may do. `now` is injectable for testing."""
    if not settings.TOTP_ENFORCEMENT_ENABLED:
        return Decision(EXEMPT, "enforcement_disabled")

    if totp_enabled:
        return Decision(EXEMPT, "totp_enabled")

    if not role_requires_2fa(role):
        return Decision(EXEMPT, "role_not_required")

    # Anchor on the first sign-in. An account that has never signed in falls back
    # to `created_at`, which is the best available approximation and is
    # deliberately not treated as "grace starts now" -- that would let an
    # attacker who can create accounts but not sign in reset the clock forever.
    anchor = _as_utc(first_login_at) or _as_utc(created_at)
    if anchor is None:
        # No timestamps at all. Block. An account the database cannot date is an
        # account the grace period cannot be measured against, and defaulting to
        # permissive here is the one choice that has no safe failure mode.
        return Decision(BLOCK, "no_timestamp_available")

    moment = _as_utc(now) or datetime.now(timezone.utc)
    grace = max(0, settings.TOTP_ENROLLMENT_GRACE_DAYS)

    # A zero-day window means "no window", not "a window of zero length".
    #
    # The general rule below is `now > deadline`, which is inclusive of the final
    # instant so that a 7-day grace keeps working on day 7 -- an owner who signed
    # in on day one should not lose access at midnight before they could install
    # an authenticator. But at grace=0 that same rule compares an instant with
    # itself, is false, and an operator who asked for strict enforcement gets a
    # day of warning they did not ask for.
    #
    # Rather than weaken the boundary rule to `>=` and lock every existing owner
    # out one day early, the zero case gets its own explicit branch. Two rules
    # beat one rule that is wrong in one of its two configurations.
    if grace == 0:
        return Decision(BLOCK, "grace_period_disabled", deadline=anchor)

    deadline = anchor + timedelta(days=grace)
    if moment > deadline:
        return Decision(BLOCK, "grace_period_expired", deadline=deadline)
    return Decision(WARN, "within_grace_period", deadline=deadline)
