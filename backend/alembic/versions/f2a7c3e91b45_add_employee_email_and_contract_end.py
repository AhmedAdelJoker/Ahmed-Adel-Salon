"""Give employees an email address and a contract end date.

Neither had anywhere to live. `employees` had contact details down to a
national ID, and `users` had an `email` column, but the `email` that exists is
the *login* address: `create_employee` only builds a `User` when
`has_login_account` is set, and most of a salon roster has no login, so for them
the column stayed NULL and there was nowhere to record an address at all.

  - `email`             the employee's own address. Deliberately NOT unique:
                        shared family and staff addresses are common, and a
                        unique constraint here would reject legitimate rosters.
                        It is a contact field, not an identity, unlike `phone`
                        which the form guards separately.
  - `contract_end_date` a plain date, meaningful for temporary/part-time
                        contracts. Not derived from `hire_date` plus a term: a
                        contract gets extended or cut short, and a reminder has
                        to run against the date actually agreed. Nullable so
                        permanent staff need no value.

Both are nullable additions, so this is safe to run against a live roster.

Shape follows the existing convention (`e7f1a2b3c4d5`, `d5e8f2a4b7c1`): shapes
declared as module-level data so `upgrade` and `downgrade` cannot drift, and
every write guarded by `_has_column` — idempotent on purpose, because a
developer database that booted since the model change may already carry these
columns through `create_all` on a rebuilt table.
"""

from alembic import op
import sqlalchemy as sa

revision = "f2a7c3e91b45"
down_revision = "e7f1a2b3c4d5"
branch_labels = None
depends_on = None


# (column name, type, server_default) — Date maps to DATE on SQLite via
# sqlalchemy's own Date type, not a bare string.
_NEW_COLUMNS = (
    ("email", sa.String(255), None),
    ("contract_end_date", sa.Date(), None),
)


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


def downgrade() -> None:
    bind = op.get_bind()
    for name, *_ in reversed(_NEW_COLUMNS):
        if _has_column(bind, "employees", name):
            op.drop_column("employees", name)