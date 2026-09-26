"""Reversible encryption for TOTP (2FA) seeds.

A TOTP seed is a *shared* secret: the server has to be able to recompute the
current one-time code, so unlike a password it cannot be hashed. Stored in
plaintext it means anyone who can read the database (a stolen backup, a
read-only SQL injection, a leaked dump) can generate valid codes and bypass 2FA
completely. So the seed is encrypted at rest with Fernet (AES-128-CBC +
HMAC-SHA256).

The key is derived from the application ``SECRET_KEY`` with HKDF-SHA256, which
keeps a direct install free of extra configuration. Consequences worth knowing:

* Rotating ``SECRET_KEY`` makes existing seeds undecryptable, so every user with
  2FA enabled has to re-enrol. An owner can clear a user's 2FA to recover access.
* Rows written before this change hold a plaintext base32 seed. They keep
  working and are transparently re-encrypted the next time they are verified.
"""

from __future__ import annotations

import base64
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings

# Fernet tokens are versioned: 0x80 in the first byte base64-encodes to "gAAAA".
# Anything without this prefix is a legacy plaintext base32 seed.
_FERNET_PREFIX = "gAAAAA"
_KDF_INFO = b"salonpro-totp-v1"

# Cache keyed by the secret it was derived from so tests (and a rotated
# SECRET_KEY) never get a stale cipher.
_fernet_cache: dict[str, Fernet] = {}


class TotpSecretUnavailable(RuntimeError):
    """Stored seed looks encrypted but cannot be decrypted with this SECRET_KEY."""


def _fernet() -> Fernet:
    secret_key = settings.SECRET_KEY or ""
    cached = _fernet_cache.get(secret_key)
    if cached is not None:
        return cached
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=_KDF_INFO,
    ).derive(secret_key.encode("utf-8"))
    cipher = Fernet(base64.urlsafe_b64encode(derived))
    _fernet_cache[secret_key] = cipher
    return cipher


def is_encrypted(stored: Optional[str]) -> bool:
    return bool(stored) and stored.startswith(_FERNET_PREFIX)


def is_legacy_plaintext(stored: Optional[str]) -> bool:
    return bool(stored) and not is_encrypted(stored)


def encrypt_totp_secret(secret: Optional[str]) -> Optional[str]:
    """Encrypt a plaintext base32 seed. Already-encrypted values pass through."""
    if not secret or is_encrypted(secret):
        return secret
    return _fernet().encrypt(secret.encode("utf-8")).decode("ascii")


def decrypt_totp_secret(stored: Optional[str]) -> Optional[str]:
    """Return the plaintext seed.

    Legacy plaintext rows are returned as-is so upgrades keep working. A value
    that *looks* encrypted but fails to decrypt means SECRET_KEY was rotated:
    that raises instead of silently falling back, so the caller can fail closed
    and log something actionable rather than reporting a wrong code forever.
    """
    if not stored:
        return None
    if is_legacy_plaintext(stored):
        return stored
    try:
        return _fernet().decrypt(stored.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise TotpSecretUnavailable(
            "Stored TOTP secret cannot be decrypted with the current SECRET_KEY"
        ) from exc
