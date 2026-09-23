"""Read-heavy Locust workload for Salon Management Pro.

Authentication uses ``E2E_USERNAME`` and ``E2E_PASSWORD``. The development
defaults match the seeded local E2E account.
"""

import os
from typing import Final

from locust import HttpUser, between, task

DEFAULT_API_URL: Final = "http://127.0.0.1:8000"
DEFAULT_USERNAME: Final = "admin"
DEFAULT_PASSWORD: Final = "TestAdmin123"


# Run from the repository root:
# backend/.venv/Scripts/locust -f backend/locustfile.py --host http://127.0.0.1:8000
class SalonProUser(HttpUser):
    """Exercise the read-heavy API paths identified in Phase 5 audit section 8.2."""

    host = os.getenv("E2E_API_URL", DEFAULT_API_URL)
    wait_time = between(0.5, 2)
    access_token: str | None = None

    def on_start(self) -> None:
        """Obtain a bearer token, but keep the workload usable without credentials."""
        self.access_token = None
        username = os.getenv("E2E_USERNAME", DEFAULT_USERNAME)
        password = os.getenv("E2E_PASSWORD", DEFAULT_PASSWORD)

        try:
            response = self.client.post(
                "/api/v1/auth/login",
                data={"username": username, "password": password},
                name="POST /api/v1/auth/login",
            )
            if response.ok:
                payload = response.json()
                if isinstance(payload, dict):
                    token = payload.get("access_token")
                    if isinstance(token, str) and token:
                        self.access_token = token
            if self.access_token is None:
                self.logger.warning("Login failed; continuing without a bearer token")
        except Exception as exc:
            self.logger.warning("Login could not be completed: %s", exc)

    def _auth_headers(self) -> dict[str, str]:
        """Return authorization headers when login succeeded."""
        if self.access_token is None:
            return {}
        return {"Authorization": f"Bearer {self.access_token}"}

    @task(5)
    def owner_summary(self) -> None:
        """Load the owner dashboard summary."""
        self.client.get(
            "/api/v1/dashboard/owner-summary",
            headers=self._auth_headers(),
            name="GET /api/v1/dashboard/owner-summary",
        )

    @task(5)
    def cashier_summary(self) -> None:
        """Load the cashier dashboard summary."""
        self.client.get(
            "/api/v1/dashboard/cashier-summary",
            headers=self._auth_headers(),
            name="GET /api/v1/dashboard/cashier-summary",
        )

    @task(6)
    def reports_overview(self) -> None:
        """Load the report overview."""
        self.client.get(
            "/api/v1/reports/overview",
            headers=self._auth_headers(),
            name="GET /api/v1/reports/overview",
        )

    @task(2)
    def customers(self) -> None:
        """Load the customer list."""
        self.client.get(
            "/api/v1/customers",
            headers=self._auth_headers(),
            name="GET /api/v1/customers",
        )

    @task(3)
    def invoices(self) -> None:
        """Load the first page of invoices."""
        self.client.get(
            "/api/v1/invoices?page=1&page_size=25",
            headers=self._auth_headers(),
            name="GET /api/v1/invoices?page=1&page_size=25",
        )
