"""Barber dashboard schema: the indexes and columns the API depends on.

These exist because the schema used to live only in `app/db/runtime_schema.py`,
which runs at application startup. A database built any other way -- a fresh
`alembic upgrade head` on a new server, or `Base.metadata.create_all`, which is
what this suite itself does -- got a different shape from the same code, and the
difference is invisible until a query gets slow or a column is missing.

The specific failure this file guards against is a model and `runtime_schema`
disagreeing on an index *name*. `AppointmentService.appointment_id` carried
`index=True`, which generates `ix_appointment_services_appointment_id`, while
`runtime_schema` and migration `b4f1c2d8a90e` both create
`ix_appointment_services_appointment` for that same column. On a `create_all`
database the migration then added a second index over identical data.
"""
from sqlalchemy import inspect, text

from app.db.base_class import Base


def _columns():
    return {c.name for c in Base.metadata.tables["appointments"].columns}


def test_appointment_has_a_started_at_column():
    """`GET /barber/appointments/{id}` returns this; without it the timer cannot
    be rebuilt after a reload."""
    assert "started_at" in _columns()


def test_preferences_has_the_notification_preferences_column():
    """The granular switches live here. Without the column the endpoint silently
    keeps only the master flag and the barber's per-event choices do not persist."""
    columns = {c.name for c in Base.metadata.tables["preferences"].columns}
    assert "notification_preferences" in columns


def _index_names(table: str) -> set:
    return {i.name for i in Base.metadata.tables[table].indexes}


def test_earnings_index_leads_with_the_equality_columns():
    """`earnings-summary` filters `barber_id = ? AND is_draft = 0 AND created_at >= ?`.

    Column order decides whether `is_draft` narrows the scan before the date
    range opens, so the two equality columns must precede the range column.
    """
    idx = next(
        i for i in Base.metadata.tables["invoices"].indexes
        if i.name == "ix_invoices_barber_draft_created"
    )
    assert [c.name for c in idx.columns] == ["barber_id", "is_draft", "created_at"]


def test_supporting_indexes_exist_with_the_names_the_migration_creates():
    """`selectinload` batches and the undeducted-advance sum scan these columns on
    every dashboard load."""
    assert "ix_appointment_services_appointment" in _index_names("appointment_services")
    assert "ix_salary_advances_employee_deducted" in _index_names("salary_advances")


def test_no_duplicate_index_on_appointment_services_appointment_id():
    """Two indexes over one column cost a write and a page of disk each, and buy
    nothing. This is the assertion that would have caught the `index=True` vs
    runtime_schema naming split."""
    table = Base.metadata.tables["appointment_services"]
    covering = [
        idx.name for idx in table.indexes
        if idx.columns and idx.columns[0].name == "appointment_id"
    ]
    assert len(covering) == 1, f"expected one index, found {covering}"


def test_index_covers_a_query_without_a_sequential_scan(db_session):
    """A declared index that the planner ignores is decoration; assert the plan."""
    plan = db_session.execute(
        text(
            "EXPLAIN QUERY PLAN "
            "SELECT * FROM appointment_services WHERE appointment_id = 1"
        )
    ).fetchall()
    detail = " | ".join(str(row[-1]) for row in plan)

    assert "USING INDEX" in detail or "USING COVERING INDEX" in detail, detail
    assert "SCAN appointment_services" not in detail.replace(
        "SCAN appointment_services USING", ""
    ), detail