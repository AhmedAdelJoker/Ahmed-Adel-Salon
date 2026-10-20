"""`stub_env.STUB_ENV` must stay sufficient to import the application.

`Settings` validates at import time, so every entry point that imports `app`
outside production -- the test suite, the authorisation audit, the E2E launcher
-- depends on this list being complete. It was hand-copied in three places and
two of the copies were wrong in ways only CI could see:

* `scripts/audit_authorization.py` was missing `FIRST_SUPERUSER_PASSWORD`, so the
  `security-sast` job failed inside a step called "Authorisation audit".
* `e2e_server.py` was missing `SECRET_KEY`, which is invisible on a developer
  machine because the untracked `backend/.env` supplies it there, and fatal in
  CI where there is no `.env`. Playwright reported it as "Process from
  config.webServer was not able to start".

Neither could be caught by asserting the stubs are importable in-process: under
pytest `conftest` has already populated everything, so a missing field hides.
These tests therefore check the two things that do not depend on the ambient
environment -- the list covers every required field, and a clean child process
can actually build `Settings` from it.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import Settings  # noqa: E402
from stub_env import STUB_ENV  # noqa: E402


def test_stub_env_covers_every_required_setting():
    """Names the missing field, which is the whole point of the test."""
    required = {name for name, field in Settings.model_fields.items() if field.is_required()}
    missing = sorted(required - set(STUB_ENV))
    assert not missing, (
        f"Settings requires {missing}, which stub_env.STUB_ENV does not provide. "
        "Add it there, not to the callers."
    )


def test_a_clean_process_can_build_settings_from_stub_env(tmp_path):
    """Reproduce the CI condition exactly, since nothing else can.

    No inherited secrets, and a working directory with no `.env`, because
    `Settings(env_file='.env')` would otherwise satisfy every field from the
    developer's own file and this test would pass for the wrong reason -- which
    is precisely how `e2e_server.py` shipped broken.
    """
    bootstrap = {
        key: os.environ[key]
        for key in ("PATH", "SYSTEMROOT", "WINDIR", "HOME", "LANG")
        if key in os.environ
    }
    result = subprocess.run(
        [sys.executable, "-c", "from app.core.config import Settings; Settings()"],
        cwd=tmp_path,
        env={**bootstrap, **STUB_ENV, "PYTHONPATH": str(BACKEND_ROOT)},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "a process with only stub_env.STUB_ENV cannot construct Settings, so "
        f"every caller that imports the app without a real environment fails:\n{result.stderr}"
    )


def test_stub_env_values_pass_the_production_guards():
    """The stubs must not be values `Settings` would reject in production.

    `validate_secret_key` and `validate_superuser_password` exist to stop a
    placeholder reaching a real deployment. A stub that those guards reject
    would be fixed by weakening the guard, which is the wrong direction.
    """
    for key, value in STUB_ENV.items():
        if key == "SECRET_KEY":
            assert len(value) >= 32, f"{key} would be rejected as too short"
        if key == "FIRST_SUPERUSER_PASSWORD":
            assert len(value) >= 8, f"{key} would be rejected as too short"
            assert value not in {"admin123", "Admin@123", "252525", "password"}
