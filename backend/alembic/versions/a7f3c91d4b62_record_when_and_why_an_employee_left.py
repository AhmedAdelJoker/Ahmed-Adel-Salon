"""Record when and why an employee left the salon.

The archive page asked two questions it had nowhere to answer. `status` said
`resigned`, and that was all: no date, so the page printed the hire date and a
tenure nobody could check; no reason, so a year later the owner could not tell
someone who quit from someone dismissed; no actor, so the decision had no name
beside it. The admin endpoint that claimed to store these (`archive_staff`)
wrote `is_archived`/`archived_at` on a model that never had those columns, and
its router was never registered, so nothing ever landed.

  - `archived_at`          when they left. Written by the archive endpoint only.
                           NULL on rows that were already `resigned` before this
                           existed: the date was never agreed by anyone, and
                           inventing one from `updated_at` would put a fabricated
                           day into a payroll dispute.
  - `archive_reason`       free text, capped like the customer precedent.
  - `archived_by_user_id`  who decided. Its own FK, not the employee's login:
                           most of a roster has no `users` row, and the owner
                           pressing archive is a different actor anyway.

All three are nullable, so this runs against a live roster without a backfill.
Shape follows `f2a7c3e91b45`: columns as module-level data so `upgrade` and
`downgrade` cannot drift, every write guarded by `_has_column` — idempotent,
because a developer database that booted since the model change may already
carry them through `create_all`.
"""

from alembic import op
import sqlalchemy as sa

revision = "a7f3c91d4b62"
down_revision = "a9c4e2f7b1d6"
branch_labels = None
depends_on = None

_NEW_COLUMNS = (
    ("archived_at", sa.DateTime(), None),
    ("archive_reason", sa.String(500), None),
    ("archived_by_user_id", sa.Integer(), None),
)

_FK_NAME = "fk_employees_archived_by_user"


def _has_table(bind, name: str) -> bool:
    return name in sa.inspect(bind).get_table_names()


def _has_column(bind, table: str, column: str) -> bool:
    if not _has_table(bind, table):
        return False
    return column in {c["name"] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "employees"):
        return
    for name, type_, server_default in _NEW_COLUMNS:
        if not _has_column(bind, "employees", name):
            op.add_column(
                "employees",
                sa.Column(name, type_, nullable=True, server_default=server_default),
            )
    if not sa.inspect(bind).get_foreign_keys("employees") or not any(
        fk.get("name") == _FK_NAME
        for fk in sa.inspect(bind).get_foreign_keys("employees")
    ):
        with op.batch_alter_table("employees") as batch_op:
            batch_op.create_foreign_key(
                _FK_NAME, "users", ["archived_by_user_id"], ["id"]
            )


def downgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "employees"):
        return
    if any(
        fk.get("name") == _FK_NAME
        for fk in sa.inspect(bind).get_foreign_keys("employees")
    ):
        with op.batch_alter_table("employees") as batch_op:
            batch_op.drop_constraint(_FK_NAME, type_="foreignkey")
    for name, *_ in reversed(_NEW_COLUMNS):
        if _has_column(bind, "employees", name):
            op.drop_column("employees", name)
