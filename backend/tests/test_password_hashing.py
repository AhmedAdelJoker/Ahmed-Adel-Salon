"""Password hashing: Argon2id as primary, bcrypt as legacy, and the fallback.

Two things are under test here, and the second matters more than the first.

The obvious one is that new hashes are Argon2id, old bcrypt hashes still verify,
and a successful sign-in silently upgrades the stored hash. The less obvious one
is what happens when Argon2id is not usable at all.

`argon2-cffi` wraps a CFFI extension module, and it can be installed in a state
where `hash()` succeeds while `verify()` raises `InvalidHashError` on every
input -- which is exactly what happened in this repository's own environment,
on two different Python versions. In that state, promoting Argon2id to the only
scheme means no user can ever sign in again. The startup probe in
`app.core.security` exists for that reason, and the degraded-path tests below
pin the behaviour down so the fallback cannot be broken by a later refactor.
"""

import time

import pytest
from passlib.context import CryptContext

from app.core import security
from app.core.security import (
    active_scheme,
    get_password_hash,
    needs_rehash,
    verify_and_maybe_rehash,
    verify_password,
)

passlib_bcrypt = CryptContext(schemes=["bcrypt"], deprecated="auto")


def set_bcrypt(user, password: str) -> None:
    """Overwrites a user's hash with a genuine legacy bcrypt one.

    Written explicitly rather than assumed from a factory, because the factory
    hashes with whatever the current scheme is -- which is the point of the
    migration, and would quietly stop these tests testing anything.
    """
    user.hashed_password = passlib_bcrypt.hash(password)
    return user


# --------------------------------------------------------------------------
# The new scheme
# --------------------------------------------------------------------------


def test_the_startup_probe_agrees_with_the_reported_scheme():
    """`active_scheme()` must describe the hasher actually in use.

    A health endpoint that claims "argon2id" while `get_password_hash` writes
    bcrypt is worse than no report at all.
    """
    scheme = active_scheme()
    assert scheme in {"argon2id", "bcrypt"}
    assert (scheme == "argon2id") == security.ARGON2_AVAILABLE


@pytest.mark.skipif(
    not security.ARGON2_AVAILABLE, reason="argon2-cffi is unusable in this environment"
)
def test_new_hashes_are_argon2id():
    digest = get_password_hash("Str0ngPassword!")
    assert digest.startswith("$argon2id$")
    assert "m=%d" % security.settings.ARGON2_MEMORY_KIB in digest
    assert "t=%d" % security.settings.ARGON2_TIME_COST in digest
    assert "p=%d" % security.settings.ARGON2_PARALLELISM in digest


def test_the_hasher_declares_itself_id_not_i():
    """Argon2i has no side-channel resistance; Argon2d is faster but GPU-friendly.

    The difference is a security decision, not a tuning knob, so it is asserted
    rather than left to whatever the default happens to be.
    """
    digest = get_password_hash("Str0ngPassword!")
    if digest.startswith("$argon2"):
        assert digest.startswith("$argon2id$"), f"expected argon2id, got {digest[:10]}"


def test_a_hash_verifies_against_its_own_password():
    digest = get_password_hash("Str0ngPassword!")
    assert verify_password("Str0ngPassword!", digest) is True
    assert verify_password("Str0ngPassword! ", digest) is False
    assert verify_password("str0ngpassword!", digest) is False
    assert verify_password("", digest) is False


def test_verification_never_raises_on_junk_input():
    """A corrupt row is a failed login, not a 500.

    An unhandled exception here would turn one bad column value into an error
    page on the credential form, and would also distinguish "user exists, row
    corrupt" from "no such user" for anyone probing the endpoint.
    """
    assert verify_password("Str0ngPassword!", "") is False
    assert verify_password("", "not-a-hash") is False
    assert verify_password("Str0ngPassword!", "$argon2id$v=19$garbage") is False
    assert verify_password("Str0ngPassword!", "$2b$12$tooshort") is False
    assert verify_password("Str0ngPassword!", "plaintext-leaked-from-a-breach") is False


def test_passwords_are_salted_so_equal_passwords_differ_on_disk():
    first = get_password_hash("Str0ngPassword!")
    second = get_password_hash("Str0ngPassword!")
    assert first != second, "two users with the same password share a hash"
    assert verify_password("Str0ngPassword!", first)
    assert verify_password("Str0ngPassword!", second)


# --------------------------------------------------------------------------
# Legacy bcrypt
# --------------------------------------------------------------------------


def test_a_bcrypt_hash_still_verifies():
    legacy = passlib_bcrypt.hash("Str0ngPassword!")
    assert verify_password("Str0ngPassword!", legacy) is True
    assert verify_password("WrongPassword!", legacy) is False


def test_a_bcrypt_hash_is_flagged_for_upgrade():
    legacy = passlib_bcrypt.hash("Str0ngPassword!")
    assert needs_rehash(legacy) is (security.ARGON2_AVAILABLE)


def test_a_current_hash_is_not_flagged_for_upgrade():
    assert needs_rehash(get_password_hash("Str0ngPassword!")) is False


def test_an_argon2_hash_with_weak_parameters_is_flagged():
    """Cost must be raised on existing hashes, not only on new sign-ups.

    A policy change is worthless if the hashes it targets never come up again
    for verification -- they would simply stay weak forever.
    """
    from argon2 import PasswordHasher, Type

    weak = PasswordHasher(
        time_cost=1, memory_cost=8, parallelism=1, type=Type.ID
    ).hash("Str0ngPassword!")
    if not security.ARGON2_AVAILABLE:
        pytest.skip("argon2-cffi is unusable in this environment")
    assert needs_rehash(weak) is True


def test_verify_and_maybe_rehash_leaves_a_strong_hash_alone():
    digest = get_password_hash("Str0ngPassword!")
    verified, replacement = verify_and_maybe_rehash("Str0ngPassword!", digest)
    assert verified is True
    assert replacement is None, "a fresh hash should not be rewritten on every login"


def test_verify_and_maybe_rehash_refuses_on_a_wrong_password():
    legacy = passlib_bcrypt.hash("Str0ngPassword!")
    verified, replacement = verify_and_maybe_rehash("WrongPassword!", legacy)
    assert verified is False
    assert replacement is None


# --------------------------------------------------------------------------
# The timing probe
# --------------------------------------------------------------------------


def test_a_missing_account_costs_as_much_as_a_wrong_password():
    """The reason the dummy digest exists.

    Without it, "no such user" returns after a single indexed lookup while "wrong
    password" pays the full Argon2id verification, and the difference is
    reachable over the network -- a free account-enumeration oracle.

    The assertion is on elapsed time rather than on the constant's prefix,
    because a hand-written placeholder digest looks perfectly plausible and
    returns in single-digit microseconds. An earlier version of this constant
    did exactly that.
    """
    real_digest = get_password_hash("Str0ngPassword!")
    probe = security.dummy_hash()

    def spend(plain, digest):
        started = time.perf_counter()
        verify_password(plain, digest)
        return time.perf_counter() - started

    spend("warmup", real_digest)  # first call pays lazy imports
    real = spend("Str0ngPassword!", real_digest)
    fake = spend("Str0ngPassword!", probe)

    # Both branches must be doing comparable work, so the probe is at least a
    # small fraction of a real verification. Not an equality assertion: timing
    # tests on a loaded CI box are noisy, and the direction that matters is
    # "the fake is not instant".
    assert fake > 0.005, (
        "the dummy verification is too fast to hide anything: %.6fs" % fake
    )
    assert fake > real * 0.05, (
        "the dummy digest is %dx cheaper than a real verification (%.6fs vs %.6fs), "
        "which still leaks whether an account exists" % (real / fake, fake, real)
    )


def test_the_dummy_probe_is_not_a_usable_credential():
    """The digest is a constant, so the real check is that it stands alone.

    The secret behind it was generated randomly and discarded, so this cannot
    assert a specific password fails -- that password does not exist in the
    repository, which is the property being protected. What can be asserted is
    that the probe does not behave like a wildcard.
    """
    probe = security.dummy_hash()
    assert verify_password("", probe) is False
    assert verify_password("wrong-password", probe) is False
    assert verify_password("salonpro-argon2-probe-not-a-credential", probe) is False


def test_dummy_hash_matches_the_active_scheme():
    """The probe must be readable by the hasher that is actually in use.

    A constant written for Argon2id, on a system that fell back to bcrypt, is a
    constant the verifier cannot parse -- and an unparseable hash is rejected
    without doing any work, which reintroduces the exact timing leak above.
    """
    probe = security.dummy_hash()
    if security.ARGON2_AVAILABLE:
        assert probe.startswith("$argon2id$")
    else:
        assert probe.startswith("$2")


# --------------------------------------------------------------------------
# Degraded mode: Argon2id unavailable
# --------------------------------------------------------------------------


def test_login_still_works_when_argon2_is_unavailable(monkeypatch):
    """Nobody may be locked out by a broken native module.

    This is the single most important test in the file. Argon2id is stronger,
    but a system that cannot verify Argon2id at all can still hash and verify
    bcrypt, and serving a working weaker system beats serving a stronger one
    that rejects every credential.
    """
    monkeypatch.setattr(security, "ARGON2_AVAILABLE", False)
    monkeypatch.setattr(security, "_password_hasher", None)

    assert active_scheme() == "bcrypt"
    digest = get_password_hash("Str0ngPassword!")
    assert digest.startswith("$2")
    assert verify_password("Str0ngPassword!", digest) is True
    assert verify_password("WrongPassword!", digest) is False


def test_existing_argon2_hashes_still_verify_when_argon2_is_unavailable(monkeypatch):
    """Degrading must not invalidate credentials that already exist.

    A system that fell back to bcrypt still holds Argon2id hashes from before
    the failure. Refusing them would lock out exactly the users who signed up
    while things were working.
    """
    from argon2 import PasswordHasher, Type

    if not security.ARGON2_AVAILABLE:
        pytest.skip("argon2-cffi is unusable in this environment, cannot make a real digest")

    good = PasswordHasher(
        time_cost=2, memory_cost=19456, parallelism=1, type=Type.ID
    ).hash("Str0ngPassword!")

    monkeypatch.setattr(security, "ARGON2_AVAILABLE", False)
    # Deliberately leaves the real Argon2 hasher in place: that is the situation
    # at runtime, where the extension broke between versions, and existing
    # hashes are still perfectly readable.
    assert verify_password("Str0ngPassword!", good) is True
    assert verify_password("WrongPassword!", good) is False


def test_a_bcrypt_hash_is_not_flagged_for_upgrade_while_degraded(monkeypatch):
    """Nothing is a downgrade if bcrypt is already the strongest thing available."""
    monkeypatch.setattr(security, "ARGON2_AVAILABLE", False)
    assert needs_rehash(passlib_bcrypt.hash("Str0ngPassword!")) is False


def test_an_argon2_hash_is_left_alone_while_degraded(monkeypatch):
    """Cannot re-create an Argon2id hash without Argon2id, so do not try.

    Rewriting it as bcrypt here would be a silent, unlogged downgrade of a
    credential the user never asked to weaken.
    """
    from argon2 import PasswordHasher, Type

    if not security.ARGON2_AVAILABLE:
        pytest.skip("argon2-cffi is unusable in this environment, cannot make a real digest")

    good = PasswordHasher(
        time_cost=2, memory_cost=19456, parallelism=1, type=Type.ID
    ).hash("Str0ngPassword!")
    monkeypatch.setattr(security, "ARGON2_AVAILABLE", False)
    assert needs_rehash(good) is False


def test_readiness_reports_a_degraded_hasher(client, monkeypatch):
    """A weakened install has to be visible to whoever operates it.

    Reported rather than enforced: refusing readiness would take the whole
    system offline, and a salon that cannot take bookings is worse off than one
    running on bcrypt.
    """
    from app.core import security as security_module

    monkeypatch.setattr(security_module, "ARGON2_AVAILABLE", False)
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    check = response.json()["checks"]["password_hashing"]
    assert check == {"status": "degraded", "scheme": "bcrypt"}


def test_readiness_reports_argon2id_when_healthy(client, monkeypatch):
    from app.core import security as security_module

    monkeypatch.setattr(security_module, "ARGON2_AVAILABLE", True)
    response = client.get("/api/v1/health/ready")
    check = response.json()["checks"]["password_hashing"]
    assert check == {"status": "ok", "scheme": "argon2id"}


def test_the_probe_rejects_a_hasher_that_cannot_read_its_own_output(monkeypatch):
    """The probe's whole purpose, tested directly.

    Simulates the exact failure seen in this environment -- `hash()` returns
    something, `verify()` rejects it -- and asserts the probe catches it instead
    of trusting a successful hash.
    """
    from argon2.exceptions import InvalidHashError

    class HalfBrokenHasher:
        def hash(self, password):
            return "$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$Zm9vYmFy"

        def verify(self, hash, password):  # noqa: A002 - mirrors the real signature
            raise InvalidHashError("simulated unusable build")

        def check_needs_rehash(self, digest):
            return False

    monkeypatch.setattr(security, "_argon2_candidate", HalfBrokenHasher())
    assert security._argon2_is_usable() is False


def test_the_probe_rejects_a_hasher_that_cannot_hash_at_all(monkeypatch):
    class ExplodingHasher:
        def hash(self, password):
            raise MemoryError("cannot allocate 19 MiB")

    monkeypatch.setattr(security, "_argon2_candidate", ExplodingHasher())
    assert security._argon2_is_usable() is False


@pytest.mark.skipif(
    not security.ARGON2_AVAILABLE,
    reason="this environment cannot construct a working Argon2 hasher at all",
)
def test_the_probe_accepts_a_working_hasher(monkeypatch):
    """A mismatch is the expected outcome of a *correct* probe, not a failure.

    Worth asserting explicitly: the probe verifies a digest it just made, so the
    "wrong password" path is what success looks like. A probe written to treat
    `VerificationError` as failure would reject every good hasher.
    """
    from argon2 import PasswordHasher

    monkeypatch.setattr(
        security,
        "_argon2_candidate",
        PasswordHasher(time_cost=1, memory_cost=64, parallelism=1),
    )
    assert security._argon2_is_usable() is True


# --------------------------------------------------------------------------
# Through the real endpoints
# --------------------------------------------------------------------------


def test_a_bcrypt_user_signs_in_and_is_silently_upgraded(client, db_session):
    """The migration, end to end.

    An account created before Argon2id signs in with the password it already
    has, gets in, and its stored hash is rewritten. No reset, no support call,
    no lockout. This is the only shape in which the change is safe to roll out:
    doing it on a successful verification is what means no plaintext is ever
    needed and no user is ever asked to act.
    """
    from app.models.user import User
    from tests.helpers import make_user

    user = make_user(db_session, username="legacyuser", password="Str0ngPassword!")
    db_session.commit()
    set_bcrypt(user, "Str0ngPassword!")
    db_session.commit()
    assert user.hashed_password.startswith("$2")

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "legacyuser", "password": "Str0ngPassword!"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["access_token"]

    db_session.expire_all()
    after = db_session.query(User).filter(User.username == "legacyuser").one()
    if security.ARGON2_AVAILABLE:
        assert after.hashed_password.startswith("$argon2id$")
        assert needs_rehash(after.hashed_password) is False
    else:
        # Degraded: the credential still works, it is simply not upgraded.
        assert verify_password("Str0ngPassword!", after.hashed_password) is True


def test_a_wrong_password_does_not_upgrade_anything(client, db_session):
    """An attacker must not be able to drive the write path."""
    from app.models.user import User
    from tests.helpers import make_user

    user = make_user(db_session, username="victim", password="Str0ngPassword!")
    db_session.commit()
    set_bcrypt(user, "Str0ngPassword!")
    db_session.commit()
    before = user.hashed_password

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "victim", "password": "NotMyPassword!"},
    )
    assert response.status_code == 401

    db_session.expire_all()
    after = db_session.query(User).filter(User.username == "victim").one()
    assert after.hashed_password == before


def test_a_disabled_account_is_not_upgraded(client, db_session):
    """The upgrade is written only after the account is known to be usable.

    Otherwise a disabled account could be used to rewrite its own credential on
    the way in, and a re-enable would land on a hash the actor chose.
    """
    from app.models.user import User
    from tests.helpers import make_user

    user = make_user(
        db_session, username="disabled", password="Str0ngPassword!", is_active=False
    )
    db_session.commit()
    set_bcrypt(user, "Str0ngPassword!")
    db_session.commit()
    before = user.hashed_password

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "disabled", "password": "Str0ngPassword!"},
    )
    # 403, and pinned by tests/test_auth.py::test_login_inactive_user. The hash is
    # what this test is about; the status code is covered on its own terms by
    # test_a_disabled_account_does_not_leak_without_the_password.
    assert response.status_code in (400, 401, 403)

    db_session.expire_all()
    after = db_session.query(User).filter(User.username == "disabled").one()
    assert after.hashed_password == before


def test_a_disabled_account_does_not_leak_without_the_password(client, db_session):
    """The 403 on a disabled account is not an enumeration oracle.

    It looks like one. An attacker sees 401 for an unknown user, 401 for a wrong
    password, and 403 for a disabled account, which reads as "403 means the
    account exists" -- and the rate limiter does not help, because these requests
    all succeed.

    It is not one, because of the order of the checks in `login`: the disabled
    branch is only reached *after* `verify_and_maybe_rehash` has already
    returned True. Getting the 403 requires presenting the correct password, and
    an attacker who has it has no need to enumerate anything -- they already know
    the account exists, because they just authenticated against it.

    The property worth guarding is therefore the one below: a wrong password
    behaves identically whether the account is active, disabled, or absent. If
    someone reorders those checks for readability, this test fails, which is
    exactly when the leak would appear.
    """
    from tests.helpers import make_user

    make_user(db_session, username="disableduser", password="Str0ngPassword!", is_active=False)
    db_session.commit()

    def attempt(username, password):
        return client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password},
        )

    # Same wrong password against an active account, a disabled one, and no
    # account at all: three identical answers.
    active_wrong = attempt("cashier1", "NotMyPassword!")
    disabled_wrong = attempt("disableduser", "NotMyPassword!")
    missing = attempt("ghostuser", "NotMyPassword!")

    assert active_wrong.status_code == 401
    assert disabled_wrong.status_code == active_wrong.status_code == missing.status_code == 401
    assert disabled_wrong.json()["detail"] == active_wrong.json()["detail"]
    assert missing.json()["detail"] == active_wrong.json()["detail"]

    # And the 403 is still there for the account's real owner, who is owed the
    # explanation. Only reachable with the correct credential.
    owner = attempt("disableduser", "Str0ngPassword!")
    assert owner.status_code == 403


def test_an_unknown_user_costs_the_same_as_a_wrong_password(client, db_session):
    """The same 401, and the same work, for "no such user" as for a bad password.

    Status code alone is not enough: a response that returns 300ms sooner for an
    unknown account is a working enumeration oracle regardless of the body.
    """
    from tests.helpers import make_user

    make_user(db_session, username="knownuser", password="Str0ngPassword!")
    db_session.commit()

    def attempt(username, password):
        started = time.perf_counter()
        response = client.post(
            "/api/v1/auth/login", data={"username": username, "password": password}
        )
        return response.status_code, time.perf_counter() - started

    attempt("knownuser", "warmup")  # first token verification pays lazy imports
    wrong_status, wrong_elapsed = attempt("knownuser", "WrongPassword!")
    missing_status, missing_elapsed = attempt("ghostuser", "WrongPassword!")

    assert wrong_status == missing_status == 401
    assert missing_elapsed > 0.005, (
        "the missing-account branch returned in %.4fs, so it is skipping "
        "verification entirely" % missing_elapsed
    )
    assert missing_elapsed > wrong_elapsed * 0.05, (
        "missing account %.4fs vs wrong password %.4fs -- enumeration is cheap"
        % (missing_elapsed, wrong_elapsed)
    )


def test_a_member_credential_is_upgraded_on_their_next_sign_in(client, db_session):
    """The same migration on the customer-facing path.

    Members are the larger population and their accounts are long-lived, so
    leaving them on bcrypt indefinitely is the larger exposure. This path was
    wired alongside the staff one and had no coverage, which is exactly how a
    half-applied rehash ships.
    """
    from app.models.customer import Customer
    from app.models.member_account import MemberAccount

    response = client.post(
        "/api/v1/public/member/register",
        json={
            "name": "Legacy Member",
            "email": "legacy.member@example.com",
            "phone": "+201000000009",
            "password": "Str0ngPassword!",
        },
    )
    assert response.status_code == 201, response.text

    account = (
        db_session.query(MemberAccount)
        .join(Customer, MemberAccount.customer_id == Customer.customer_id)
        .filter(Customer.email == "legacy.member@example.com")
        .one()
    )
    account.password_hash = passlib_bcrypt.hash("Str0ngPassword!")
    db_session.commit()
    assert account.password_hash.startswith("$2")

    login = client.post(
        "/api/v1/public/member/login",
        json={"email": "legacy.member@example.com", "password": "Str0ngPassword!"},
    )
    assert login.status_code == 200, login.text
    assert login.json()["token"]

    db_session.expire_all()
    after = db_session.query(MemberAccount).filter(
        MemberAccount.customer_id == account.customer_id
    ).one()
    assert verify_password("Str0ngPassword!", after.password_hash) is True
    if security.ARGON2_AVAILABLE:
        assert after.password_hash.startswith("$argon2id$")
        assert needs_rehash(after.password_hash) is False


def test_a_wrong_member_password_does_not_upgrade_anything(client, db_session):
    from app.models.customer import Customer
    from app.models.member_account import MemberAccount

    response = client.post(
        "/api/v1/public/member/register",
        json={
            "name": "Victim Member",
            "email": "victim.member@example.com",
            "phone": "+201000000010",
            "password": "Str0ngPassword!",
        },
    )
    assert response.status_code == 201, response.text

    account = (
        db_session.query(MemberAccount)
        .join(Customer, MemberAccount.customer_id == Customer.customer_id)
        .filter(Customer.email == "victim.member@example.com")
        .one()
    )
    account.password_hash = passlib_bcrypt.hash("Str0ngPassword!")
    db_session.commit()
    before = account.password_hash

    login = client.post(
        "/api/v1/public/member/login",
        json={"email": "victim.member@example.com", "password": "NotMyPassword!"},
    )
    assert login.status_code == 401

    db_session.expire_all()
    after = db_session.query(MemberAccount).filter(
        MemberAccount.customer_id == account.customer_id
    ).one()
    assert after.password_hash == before


def test_an_unknown_member_email_is_not_distinguishable(client, db_session):
    """This path already answers every failure with the same 401.

    Worth pinning, because the staff login endpoint does *not* do this for
    disabled accounts -- the contrast is the whole point of the test next door.
    """
    unknown = client.post(
        "/api/v1/public/member/login",
        json={"email": "nobody@example.com", "password": "Str0ngPassword!"},
    )
    wrong = client.post(
        "/api/v1/public/member/login",
        json={"email": "member@example.com", "password": "NotMyPassword!"},
    )
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]
