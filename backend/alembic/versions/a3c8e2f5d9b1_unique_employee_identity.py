"""One person, one primary phone number and one national id.

Until now nothing stopped two rows from sharing either, and the data already
shows what that means: `national_id` held thirteen digits on one employee and an
embedded day 84 on another — values that describe nobody — because the column
was free text to every writer. `create_employee` and `update_employee` now
normalize and validate both fields and answer 409 on a conflict; these indexes
are the last line of defence so no future endpoint can store what the rules
forbid, even one that forgets the check.

  - `phone_primary`    unique. Two barbers sharing a number means attendance and
                       payouts land against the wrong person.
  - `national_id`      unique. NULLs are exempt (SQLite, like most engines,
                       allows any number of them), which is the point: most of a
                       roster may legitimately have no id recorded, but the ones
                       that exist identify distinct people.

Runs against a live database that already holds duplicates: `_create_index`
skips when the index exists, and a database whose data still violates the
constraint keeps working — the index simply waits to be built until the data is
fixed. `app/db/runtime_schema.py` creates the same two indexes at boot for
developer and packaged installs, which never run Alembic.
"""

from alembic import op
import sqlalchemy as sa

revision = "a3c8e2f5d9b1"
down_revision = "f2a7c3e91b45"
branch_labels = None
depends_on = None


_INDEXES = (
    (
        "ix_employees_phone_primary_unique",
        "employees",
        ["phone_primary"],
    ),
    (
        "ix_employees_national_id_unique",
        "employees",
        ["national_id"],
    ),
)


def _index_names(bind, table: str):
    try:
        return {idx["name"] for idx in sa.inspect(bind).get_indexes(table)}
    except Exception:
        return set()


def upgrade() -> None:
    bind = op.get_bind()
    if "employees" not in sa.inspect(bind).get_table_names():
        return
    existing = _index_names(bind, "employees")
    for index_name, table, columns in _INDEXES:
        if index_name in existing:
            continue
        try:
            op.create_index(index_name, table, columns, unique=True)
        except Exception:
            # Legacy duplicates on a developer database: keep working, retry on
            # a later run once the rows are merged or corrected.
            pass


def downgrade() -> None:
    bind = op.get_bind()
    if "employees" not in sa.inspect(bind).get_table_names():
        return
    existing = _index_names(bind, "employees")
    for index_name, _table, _columns in reversed(_INDEXES):
        if index_name in existing:
            op.drop_index(index_name, table_name="employees")
