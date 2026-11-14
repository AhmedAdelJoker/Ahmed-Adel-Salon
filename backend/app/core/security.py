from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from argon2.low_level import Type
from jwt.exceptions import PyJWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"

# --------------------------------------------------------------------------- #
# Password hashing
# --------------------------------------------------------------------------- #
#
# Why Argon2id
# ------------
# bcrypt is a deliberately slow *CPU-bound* KDF. That was the right trade when
# GPUs were the attacker's advantage; it is now the wrong one, because commodity
# GPUs do billions of bcrypt operations per second while the defender has one
# CPU. Argon2id is *memory-hard*: cracking it costs memory as well as time, so
# the attacker's advantage is bounded by their RAM rather than their core count.
# OWASP lists Argon2id as the first-choice password hash for exactly this
# reason.
#
# Parameters follow the OWASP Password Storage Cheat Sheet baseline
# (m=19456 KiB, t=2, p=1) rather than argon2-cffi's more conservative
# defaults, which are tuned for interactive logins on a single core. They can be
# overridden from the environment because the right cost is a property of the
# server, not a constant: a small VPS should not be asked to spend 19 MiB and
# two passes per login.
#
# Migration
# ---------
# bcrypt stays configured, but only to *verify* hashes that already exist in the
# database. Every new hash is Argon2id. When a bcrypt hash is verified
# successfully the caller is told to rehash, so accounts upgrade on their next
# successful sign-in without a password reset and without a migration job. No
# user is locked out, and no plaintext is ever handled.
#
# `argon2.low_level.Type` is imported for the algorithm constant, and the
# mismatch type from `argon2.exceptions`. Three of them are caught in
# `verify_password` because the layers disagree about which one a wrong password
# raises: `VerifyMismatchError` is a subclass of `VerificationError`, and
# `InvalidHashError` is a sibling that means the stored value could not be parsed
# at all. All three are a failed login, and none may escape.

_argon2_candidate = PasswordHasher(
    time_cost=settings.ARGON2_TIME_COST,
    memory_cost=settings.ARGON2_MEMORY_KIB,
    parallelism=settings.ARGON2_PARALLELISM,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

# Verification-only. `deprecated="auto"` marks bcrypt as needing a rehash, which
# is what `needs_rehash` below reads. It must never produce a new hash.
_bcrypt_legacy = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _argon2_is_usable() -> bool:
    """Hash a probe and read it back. A hasher that cannot read its own output is
    not a hasher.

    This is not paranoia. `argon2-cffi` wraps a CFFI extension module, and the
    ways that can go wrong fail at the moment someone tries to sign in, not at
    startup:

    * `ARGON2_MEMORY_KIB` is above the container's memory limit, so every
      `hash()` raises `MemoryError` -- a configuration change that passes review
      and then locks out every account;
    * the compiled extension is missing from a PyInstaller bundle, because CFFI
      modules are not always picked up by static analysis;
    * the parameters do not match what this build supports.

    In each case the symptom is identical: nobody can sign in, ever, until
    someone reads a traceback. Probing once at import turns that into a logged
    warning and a working, if weaker, hasher.

    Note the argument order. `PasswordHasher.verify` takes the *encoded hash
    first*, which is the opposite of `bcrypt.checkpw` and easy to get wrong;
    getting it backwards raises `InvalidHashError` on every call and looks
    exactly like a broken installation.
    """
    probe = "salonpro-argon2-probe-not-a-credential"
    try:
        digest = _argon2_candidate.hash(probe)
    except Exception as exc:  # noqa: BLE001 - any failure means unusable
        logger.error("Argon2id cannot hash in this environment: %s", exc)
        return False
    try:
        _argon2_candidate.verify(digest, probe)
    except VerificationError:
        return True  # wrong password against a correct hash: the round trip works
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Argon2id produced a digest it cannot read back (%s). Falling back "
            "to bcrypt so that login keeps working.",
            type(exc).__name__,
        )
        return False
    return True


ARGON2_AVAILABLE = _argon2_is_usable()

if not ARGON2_AVAILABLE:
    logger.error(
        "Argon2id is unavailable, so new passwords will be hashed with bcrypt. "
        "Passwords remain safely hashed and timing-safe, but bcrypt is CPU-bound "
        "and therefore much weaker against GPU cracking than the configured "
        "Argon2id policy. /health/ready reports this as degraded. Check the "
        "argon2-cffi installation and the ARGON2_MEMORY_KIB limit before "
        "treating it as resolved."
    )

# The hasher actually in use. Argon2id when it works, bcrypt otherwise, so a
# broken native module degrades the strength of new hashes instead of making
# login impossible.
_password_hasher = _argon2_candidate if ARGON2_AVAILABLE else None


def active_scheme() -> str:
    """Which scheme new hashes use. Reported by /health/ready."""
    return "argon2id" if ARGON2_AVAILABLE else "bcrypt"


# Digests of a password that was generated randomly and then discarded. The
# secret is deliberately unrecoverable and appears nowhere in this repository:
# only the digest is kept, so not even a future maintainer can produce a
# successful verification against these constants. Nothing maps to them, so
# even a match would be meaningless -- but a "secret" written in the source next
# to its own hash is not a secret, and it makes the timing probe testable
# against itself.
#
# Precomputed rather than hashed at import: Argon2id is deliberately slow, and
# paying 19 MiB and two passes on every process start -- including every test
# run and every CLI invocation -- to build a constant is a real cost for no
# benefit.
#
# Both must be *genuine* digests. An earlier hand-written placeholder returned
# from verification in 1.9 microseconds, which is precisely the timing signal
# this exists to remove: a missing account became distinguishable from a wrong
# password by three orders of magnitude. The test asserts the elapsed cost, not
# just the prefix, for that reason.
#
# The bcrypt digest exists only for the degraded path, where Argon2 is unusable
# and an Argon2 digest would be rejected as unparseable -- which costs no time
# and reinstates the leak.
DUMMY_PASSWORD_HASH = (
    "$argon2id$v=19$m=19456,t=2,p=1$J+HLXvtS3B/kkyJEqymLJg"
    "$ODPQr+311lVVN8+qdKaDJ95A+adlYUBYQkYmeDG1dk8"
)
_DUMMY_BCRYPT_HASH = "$2b$12$CVjVes50eYEiQcmpKjmZl.eHoULar7eLfNjyHEXe.ZLmZxYeB8HKC"

_HASH_PREFIXES = ("$argon2", "$bcrypt", "$2a$", "$2b$", "$2y$")


def _scheme_of(hashed_password: str) -> str:
    lowered = hashed_password.strip()
    if lowered.startswith("$argon2"):
        return "argon2"
    if lowered.startswith(("$2a$", "$2b$", "$2y$")):
        return "bcrypt"
    return "unknown"


def dummy_hash() -> str:
    """The digest used to equalise timing for a non-existent account.

    Always one the active hasher can actually read, so the probe does real work
    instead of returning instantly — which is the signal the probe exists to
    remove.
    """
    return DUMMY_PASSWORD_HASH if ARGON2_AVAILABLE else _DUMMY_BCRYPT_HASH


def needs_rehash(hashed_password: str) -> bool:
    """True when this hash should be replaced with a stronger one.

    Covers three cases: a legacy bcrypt hash while Argon2id is available, an
    Argon2id hash produced with weaker parameters than the current policy, and
    an unrecognised scheme. When Argon2id is unavailable the last two still
    apply, but a bcrypt hash is no longer a downgrade.
    """
    scheme = _scheme_of(hashed_password)
    if scheme == "bcrypt":
        return ARGON2_AVAILABLE
    if scheme != "argon2":
        # Unknown or corrupt: rehash on the next successful verification.
        return True
    if not ARGON2_AVAILABLE:
        # Argon2 is not in use, so an Argon2 hash cannot be re-created. Leave it
        # alone rather than point an account at a hasher the system cannot run.
        return False
    try:
        return _argon2_candidate.check_needs_rehash(hashed_password)
    except InvalidHashError:
        return True


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Checks a password against a hash of any supported scheme.

    Never raises on a bad password or a malformed hash: both are a failed
    verification, because an exception here would turn a corrupt row in the
    database into a 500 instead of a 401.
    """
    if not plain_password or not hashed_password:
        return False

    scheme = _scheme_of(hashed_password)
    try:
        if scheme == "argon2":
            # Deliberately not gated on ARGON2_AVAILABLE.
            #
            # `PasswordHasher.verify` takes the cost parameters from the digest
            # being checked, not from the current configuration, so verifying an
            # existing hash allocates what that hash asks for and succeeds even
            # when this process cannot produce new ones -- a memory limit too low
            # for ARGON2_MEMORY_KIB, for instance, does not stop a 19 MiB hash
            # written last year from being read.
            #
            # Refusing here would lock out precisely the accounts created while
            # the system was healthy, which is the worst possible failure mode:
            # the degraded path has to keep serving the credentials it already
            # has, and only stop minting new ones.
            try:
                # Argument order: the encoded hash first, the password second.
                return _argon2_candidate.verify(hashed_password, plain_password)
            except (VerifyMismatchError, VerificationError, InvalidHashError):
                return False
        if scheme == "bcrypt":
            return _bcrypt_legacy.verify(plain_password, hashed_password)
    except Exception:  # noqa: BLE001 - a verifier must not raise
        logger.exception("Password verification raised; treating as a failure")
        return False

    return False


def verify_and_maybe_rehash(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    """Verifies, and returns a replacement hash when the stored one is weak.

    Returns `(verified, new_hash_or_None)`. The caller assigns the new hash when
    one is returned, which upgrades the account to Argon2id on its next
    successful sign-in. Doing it here rather than in a batch migration means no
    plaintext is ever required and no user has to reset anything.
    """
    if not verify_password(plain_password, hashed_password):
        return False, None
    if needs_rehash(hashed_password):
        try:
            return True, get_password_hash(plain_password)
        except Exception:  # noqa: BLE001 - never block a login on the upgrade
            logger.exception("Rehash after verification failed; keeping the old hash")
            return True, None
    return True, None


def get_password_hash(password: str) -> str:
    """Hashes a password for storage.

    Argon2id when it is usable, bcrypt otherwise. See `active_scheme`.
    """
    if _password_hasher is not None:
        return _password_hasher.hash(password)
    return _bcrypt_legacy.hash(password)


def hash_fingerprint(hashed_password: str) -> str:
    """Short, stable identifier for a stored hash.

    Useful for audit records that need to show *which* credential a user has
    without disclosing it. Not a security control: it is derived from a hash
    that is already one-way, so it reveals nothing an attacker could not
    compute from the database itself.
    """
    return hashlib.sha256(hashed_password.encode("utf-8")).hexdigest()[:12]


def constant_time_equals(left: str, right: str) -> bool:
    """Comparison that does not leak length or content through timing."""
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def validate_password_strength(password: str) -> str:
    errors = []

    if len(password) < 8:
        errors.append("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    if password.lower() == password:
        errors.append("كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل")
    if password.upper() == password:
        errors.append("كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل")
    if not any(char.isdigit() for char in password):
        errors.append("كلمة المرور يجب أن تحتوي على رقم واحد على الأقل")

    if errors:
        raise ValueError("، ".join(errors))

    return password


def _encode_token(
    subject: str,
    token_type: str,
    expires_minutes: int,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Internal helper — encode a JWT with consistent claims."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes)
    to_encode: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": now,
        "nbf": now,
        "type": token_type,
        "jti": __import__("uuid").uuid4().hex,  # unique id — used for revocation
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Short-lived access token (1 hour by default after Phase 3)."""
    minutes = (
        int(expires_delta.total_seconds() // 60)
        if expires_delta
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return _encode_token(subject, "access", minutes, extra_claims)


def create_refresh_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Long-lived refresh token (7 days) — used only to mint new access tokens."""
    return _encode_token(
        subject, "refresh", settings.REFRESH_TOKEN_EXPIRE_MINUTES, extra_claims
    )


def create_member_access_token(customer_id: int, token_version: int) -> str:
    return _encode_token(
        f"member:{customer_id}",
        "member_access",
        settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        {"scope": "member", "ver": int(token_version or 0)},
    )


def decode_token(token: str, expected_type: str = "access") -> dict[str, Any]:
    """Decode and validate a JWT. Raises on expired/invalid/wrong-type tokens."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise PyJWTError(f"Invalid token type: expected '{expected_type}'")
    return payload


# ----------------------------------------------------------------------------
# Token revocation (denylist) — Phase 3
# ----------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def revoke_jti(
    db: Session,
    jti: str | None,
    *,
    user_id: int | None = None,
    token_type: str = "access",
    reason: str = "logout",
    expires_at: datetime | None = None,
) -> bool:
    """Add a JWT id to the denylist. Returns False when there is nothing to revoke."""
    if not jti:
        return False
    from app.models.revoked_token import RevokedToken

    # Opportunistic purge of long-expired rows (keeps the table tiny).
    try:
        db.query(RevokedToken).filter(
            RevokedToken.expires_at.isnot(None),
            RevokedToken.expires_at < _utcnow(),
        ).delete(synchronize_session=False)
    except Exception:
        pass
    if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        return True
    db.add(
        RevokedToken(
            jti=jti,
            user_id=user_id,
            token_type=token_type,
            reason=reason[:64] if reason else "logout",
            expires_at=expires_at,
        )
    )
    db.flush()
    return True


def is_jti_revoked(db: Session, jti: str | None) -> bool:
    """True when the token id is denylisted. Fail-closed on missing jti."""
    if not jti:
        return True
    from app.models.revoked_token import RevokedToken

    return (
        db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None
    )


def token_version_of(user: Any) -> int:
    """Token generation of a user (0 for rows created before Phase 3)."""
    try:
        return int(getattr(user, "token_version", 0) or 0)
    except (TypeError, ValueError):
        return 0
