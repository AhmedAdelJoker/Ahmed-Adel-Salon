"""The settings needed to import the application with no real environment.

`app/core/config.py` ends with `settings = Settings()`, so the required fields
are validated at *import* time, not at first use. `DATABASE_URL`, `SECRET_KEY`
and `FIRST_SUPERUSER_PASSWORD` have no defaults, which means anything that
imports the application -- the test suite, the authorisation audit, the E2E
launcher -- has to put all three in `os.environ` before the import, or pydantic
raises and the failure is reported as whatever the importing tool happened to be
doing at the time.

This module is the single copy of that list, because there were three and every
one of them drifted:

* `scripts/audit_authorization.py` omitted `FIRST_SUPERUSER_PASSWORD`, so the
  `security-sast` job died inside a step named "Authorisation audit" -- a
  settings error wearing the label of a permissions check.
* `e2e_server.py` omits `SECRET_KEY`. It sets six other variables explicitly and
  comments that it "must not depend on CWD/.env discovery", and for that one
  field it does exactly that: the launcher only ever ran where a developer's
  untracked `backend/.env` happened to supply it. CI has no `.env`, so the E2E
  launcher could not start at all, and the failure was reported by Playwright as
  "Process from config.webServer was not able to start".
* `conftest.py` was complete, which is what hid both gaps. Under pytest every
  field is already set, so a stub list missing one is invisible to the suite --
  the two broken consumers both looked fine in the 482 tests that pass.

`tests/test_stub_env.py` pins this dict against `Settings` itself, so the next
required field fails a local test run instead of a CI job whose name has nothing
to do with the change that introduced it.

None of these values is a credential. They are rejected by the production guards
in `Settings` if they ever reach a real deployment: the secret must be at least
32 characters and must not be one of the known placeholders, and the superuser
password must be at least 8 characters and not one of the weak defaults.
"""

from __future__ import annotations

import os

#: Enough to construct `Settings`. Importable and inspectable, so the test that
#: pins it can compare against the model's required fields directly.
STUB_ENV = {
    "ENVIRONMENT": "development",
    # 43 characters, and not one of the weak defaults `Settings` rejects.
    "SECRET_KEY": "stub-env-not-a-real-secret-0123456789abcdef",
    "DATABASE_URL": "sqlite:///./stub-env.db",
    "FIRST_SUPERUSER": "admin",
    "FIRST_SUPERUSER_PASSWORD": "StubEnvNotARealSecret",
}


def provision(overrides: dict[str, str] | None = None, *, overwrite: bool = False) -> dict[str, str]:
    """Put the stub settings into `os.environ` and return what was set.

    `overwrite=False` (the default) uses `setdefault`, so a real environment
    always wins -- which is what the test suite and the audit want, since both
    may be running with a deliberate `DATABASE_URL` already in place.
    `e2e_server.py` passes `overwrite=True` because it has to own the database
    path and the CORS origins outright.

    Call this *before* importing `app`, and never from application code.
    """
    env = {**STUB_ENV, **(overrides or {})}
    for key, value in env.items():
        if overwrite:
            os.environ[key] = value
        else:
            os.environ.setdefault(key, value)
    return env
