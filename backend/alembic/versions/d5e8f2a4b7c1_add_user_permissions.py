"""Add users.permissions: per-user page-access overrides.

`GET /users` returned users whose permission matrix the frontend edited and
the backend dropped (no column, no schema field), so every change made in the
permissions dialog was silently discarded on save and the dialog was a no-op
that reported success. This column is the missing storage.

Shape: JSON object `{permission_key: bool}` where the key is the route-registry
permission key (`permissionKeyFor(route)`, e.g. "/pos", "/customers/:id") and
the value is an explicit override. Absent key or NULL column means "inherit
the role default" -- the same tri-state the dialog edits. Page access is a
frontend gate; the backend role matrix (app/core/rbac.py) still authorizes
every API operation, so this column can widen what a user *sees*, never what
the API *accepts*.

Idempotent on purpose, matching b4f1c2d8a90e: a developer database that booted
since the model change may already carry the column through `create_all` on a
rebuilt table, and `upgrade` must converge rather than fail on it.
"""

from alembic import op
import sqlalchemy as sa

revision = "d5e8f2a4b7c1"
down_revision = "b4f1c2d8a90e"
branch_labels = None
depends_on = None


def _has_table(bind, name: str) -> bool:
    return name in sa.inspect(bind).get_table_names()


def _has_column(bind, table: str, column: str) -> bool:
    if not _has_table(bind, table):
        return False
    return column in {c["name"] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "users") and not _has_column(bind, "users", "permissions"):
        # Model declares JSON; on SQLite that is stored as TEXT, the same
        # convention as preferences.notification_preferences (b4f1c2d8a90e).
        op.add_column("users", sa.Column("permissions", sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "users", "permissions"):
        op.drop_column("users", "permissions")
