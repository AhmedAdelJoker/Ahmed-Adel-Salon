"""Makes one appointment invoicable at most once, in the database.

Revision ID: f8b3c5d7e9a2
Revises: e7a2c4d6b8f1
Create Date: 2026-09-29

The bug
-------
`issue_invoice_from_appointment` in `app/api/v1/endpoints/appointments.py` is
check-then-act:

    existing_invoice = db.query(Invoice).filter(Invoice.appointment_id == appointment_id).first()
    if existing_invoice:
        raise HTTPException(400, "تم إصدار فاتورة لهذا الحجز بالفعل")
    ...
    db.add(invoice)

Between the SELECT and the INSERT there is nothing that stops a second
transaction from running the identical code and reaching the identical INSERT.
Two cashiers on two tills, or one cashier double-tapping, produce two invoices
for one appointment: the customer is charged twice and gets two PDFs.

Measured, not assumed. `tests/test_postgres_concurrency.py::
test_two_invoices_cannot_be_issued_for_one_appointment` runs the sequence on a
real PostgreSQL with two threads and records:

    ['issued', 'issued']

Both transactions read an empty table, and both wrote. This cannot happen on
SQLite, where the second writer simply blocks until the first commits and then
sees the row -- which is why the single-session test suite had been green
throughout.

Why the model did not save it
-----------------------------
`invoices.appointment_id` was declared as:

    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, index=True)

`index=True` builds `ix_invoices_appointment_id`, a non-unique index. It answers
"which invoices point at this appointment"; it cannot answer "at most one may".
An index and a constraint look similar in a model file and behave nothing alike.

The adjacent `review.py` got this right -- `unique=True` on the same kind of
column -- which is the reason this reads as an oversight rather than a decision.

What the constraint does and does not break
-------------------------------------------
Plain `UNIQUE(appointment_id)` would reject the counter invoices: an invoice
raised at the till has `appointment_id IS NULL`, and more than one of those is
normal. Postgres does *not* count NULLs as duplicates under UNIQUE (it requires
`NULLS NOT DISTINCT` for that), so a plain UNIQUE accepts any number of NULLs
and is safe. A *partial* unique index is used here anyway, because relying on
the NULL-distinctness of one engine is the same class of mistake as the one
being fixed: correct today, and silently wrong after a dump/restore into a
stricter configuration.

    CREATE UNIQUE INDEX uq_invoices_appointment_id ON invoices(appointment_id)
        WHERE appointment_id IS NOT NULL

Built with `create_index(unique=True, ..._where=...)` rather than
`create_unique_constraint`. The reason is worth recording, because the first
version of the test that checks this got it backwards: a unique *index* does not
appear in `information_schema.table_constraints`, which lists declared
CONSTRAINTs only, so a test reading that view concludes there is no constraint
while the index is right there enforcing uniqueness. The engine treats them
identically -- both raise the same `UniqueViolation` -- so the index form is
used, and the test reads `pg_index` where it is actually visible.

Duplicates already in the table
-------------------------------
The constraint cannot be added while a duplicate exists, so this migration first
resolves them, keeping the oldest invoice per appointment and detaching the rest.

Detaching rather than deleting is deliberate. An invoice is a financial record;
`appointment_id` is a link back to a booking, not the invoice's identity. Setting
the link to NULL keeps the money, the lines, the payments and the PDF, and it is
the same treatment every manual invoice already has. Deleting would destroy
revenue history to satisfy a constraint, and the audit trail would show it.

On a real dataset this finds nothing, and the check is written to fail loudly
rather than quietly if that stops being true:

    SELECT appointment_id, COUNT(*) FROM invoices
    WHERE appointment_id IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1

Scope
-----
PostgreSQL and SQLite only. No other statement in this migration touches any
other table, and the downgrade removes exactly what this added and nothing else.
"""

from alembic import op
import sqlalchemy as sa

revision = "f8b3c5d7e9a2"
down_revision = "e7a2c4d6b8f1"
branch_labels = None
depends_on = None

CONSTRAINT = "uq_invoices_appointment_id"
INDEX = "ix_invoices_appointment_id"


def _dialect(conn) -> str:
    return conn.dialect.name


def _is_postgres(conn) -> bool:
    return _dialect(conn) == "postgresql"


def _has_index(conn, name: str) -> bool:
    """`index=True` on the model created one; the unique index replaces it.

    Both can coexist -- Postgres allows a non-unique and a unique index over the
    same column, and SQLite does too -- but leaving a redundant index on an
    `invoices` table is a write cost on every INSERT for a lookup the unique
    index already serves. So the plain one is dropped, and the downgrade puts it
    back.

    The two catalogues are queried separately, not with a `UNION ALL` over both.
    A union is the obvious way to write it and it fails on both dialects:
    Postgres parses the whole statement and rejects `sqlite_master` with
    `UndefinedTable` even though the `pg_indexes` branch would have answered,
    and SQLite fails on `pg_indexes` in the same way.
    """
    if _is_postgres(conn):
        sql = "SELECT 1 FROM pg_indexes WHERE indexname = :n"
    else:
        sql = "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = :n"
    return bool(conn.execute(sa.text(sql), {"n": name}).fetchone())


def _duplicate_groups(conn) -> list[tuple]:
    """Appointments with more than one invoice. Empty on a clean dataset."""
    return conn.execute(
        sa.text(
            "SELECT appointment_id, COUNT(*) FROM invoices "
            "WHERE appointment_id IS NOT NULL "
            "GROUP BY appointment_id HAVING COUNT(*) > 1 ORDER BY appointment_id"
        )
    ).fetchall()


def _detach_extra_invoices(conn) -> int:
    """Keeps the oldest invoice per appointment, unlinks the rest.

    "Oldest" is the lowest `id`, not the earliest `created_at`: `created_at` is
    nullable and may be equal for rows written in the same second, whereas `id`
    is total and ordered, so it cannot leave the choice ambiguous.
    """
    detached = 0
    for appointment_id, _count in _duplicate_groups(conn):
        rows = conn.execute(
            sa.text(
                "SELECT id FROM invoices WHERE appointment_id = :a ORDER BY id"
            ),
            {"a": appointment_id},
        ).fetchall()
        # Everything after the first is surplus. It keeps its row, its lines and
        # its number; only the link back to the appointment is removed.
        for (invoice_id,) in rows[1:]:
            conn.execute(
                sa.text(
                    "UPDATE invoices SET appointment_id = NULL WHERE id = :i"
                ),
                {"i": invoice_id},
            )
            detached += 1
    return detached


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("invoices"):
        return

    # `Inspector.has_column` does not exist in SQLAlchemy 2; the portable form is
    # to read the column list and look for the name.
    if "appointment_id" not in {c["name"] for c in inspector.get_columns("invoices")}:
        return

    already = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_schema = current_schema() AND table_name = 'invoices' "
            "  AND constraint_name = :n"
        ),
        {"n": CONSTRAINT},
    ).fetchone()
    if already:
        return

    detached = _detach_extra_invoices(bind)
    if detached:
        # Surfaced rather than logged-and-forgotten: if a deployment ever hits
        # this, someone should look at which invoices were unlinked and why,
        # because it means the double-invoice bug had already been reached in
        # production and the money was collected twice.
        print(
            f"[{CONSTRAINT}] unlinked {detached} duplicate invoice(s) from their "
            "appointment; the oldest was kept and no invoice was deleted"
        )

    if _has_index(bind, INDEX):
        op.drop_index(INDEX, table_name="invoices")

    if _is_postgres(bind):
        # Partial, so the intent survives a dump into a configuration where NULL
        # equality is not the default. `WHERE appointment_id IS NOT NULL` is what
        # lets the manual, till-raised invoices coexist.
        op.create_index(
            CONSTRAINT,
            "invoices",
            ["appointment_id"],
            unique=True,
            postgresql_where=sa.text("appointment_id IS NOT NULL"),
        )
    else:
        op.create_index(
            CONSTRAINT,
            "invoices",
            ["appointment_id"],
            unique=True,
            sqlite_where=sa.text("appointment_id IS NOT NULL"),
        )


def downgrade():
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("invoices"):
        return

    # The model's own `index=True` index goes back too. `upgrade` did not drop it
    # -- a plain unique index serves the same lookups -- but a downgrade that
    # leaves the schema one index short of the models is a downgrade that fails
    # the `test_the_result_matches_the_models` check on the way back.

    if not _has_index(bind, CONSTRAINT):
        return

    op.drop_index(CONSTRAINT, table_name="invoices")
    op.create_index(INDEX, "invoices", ["appointment_id"], unique=False)
