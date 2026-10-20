"""The shared pagination helper must not sort the whole table to count it.

`paginate()` used to call `query.count()` on the sorted query, which compiles to
a subquery that keeps the ORDER BY. Every page request therefore sorted the
entire filtered set — work whose only output is a number, on a query that then
returns at most `size` rows. `PageParams` allows `page` up to 10,000 and `size`
to 200, so the offset alone can reach two million.

The fix is one call, `order_by(None)`, and it has to be verified rather than
assumed: a test that only checks the returned page would pass either way.
"""

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy import Column, DateTime, Integer, Numeric, String, create_engine, func
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.pagination import PageParams, paginate

Base = declarative_base()


class Thing(Base):
    __tablename__ = "things"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime, nullable=True)


@pytest.fixture
def session(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'p.db').as_posix()}")
    Base.metadata.create_all(engine)
    Session_ = sessionmaker(bind=engine)
    db = Session_()
    for i in range(500):
        db.add(Thing(name=f"item-{i}", amount=Decimal(i), created_at=datetime(2026, 1, (i % 28) + 1)))
    db.commit()
    yield db
    db.close()


def test_paginate_returns_the_right_window(session):
    result = paginate(session.query(Thing), PageParams(page=2, size=25))

    assert result.total == 500
    assert result.page == 2
    assert result.size == 25
    assert result.pages == 20
    assert len(result.items) == 25
    # Page 2 starts after the first 25 rows.
    assert result.items[0].id == 26


def test_paginate_honours_a_sort(session):
    result = paginate(
        session.query(Thing),
        PageParams(page=1, size=5, sort="-id"),
    )
    assert [t.id for t in result.items] == [500, 499, 498, 497, 496]


def test_the_count_query_carries_no_order_by(session):
    """The regression itself.

    A test that only asserted on the returned page would pass before and after
    the fix, because the page contents are identical either way. The difference
    is entirely in the SQL the count emits, so the SQL is what gets asserted.
    """
    captured: list[str] = []

    class RecordingSession(Session):
        def execute(self, statement, *args, **kwargs):
            sql = str(statement)
            captured.append(sql)
            return super().execute(statement, *args, **kwargs)

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = RecordingSession(bind=engine)
    for i in range(50):
        db.add(Thing(name=f"item-{i}", amount=Decimal(i)))
    db.commit()
    captured.clear()

    paginate(db.query(Thing), PageParams(page=1, size=10, sort="-id"))

    count_statements = [sql for sql in captured if "count" in sql.lower()]
    assert count_statements, "no count statement was captured"
    for sql in count_statements:
        assert "ORDER BY" not in sql.upper(), (
            f"the count still sorts the whole table:\n{sql}"
        )


def test_paginate_still_applies_the_sort_to_the_page(session):
    """`order_by(None)` is scoped to the count; the page must stay sorted."""
    result = paginate(
        session.query(Thing),
        PageParams(page=1, size=3, sort="-name"),
    )
    assert [t.name for t in result.items] == ["item-99", "item-98", "item-97"]  # lexicographic, so 99 sorts above 9


def test_paginate_with_no_sort_still_works(session):
    result = paginate(session.query(Thing), PageParams(page=1, size=10))
    assert result.total == 500
    assert len(result.items) == 10


def test_paginate_on_an_empty_result(session):
    result = paginate(session.query(Thing).filter(Thing.name == "nope"), PageParams(page=1, size=10))
    assert result.total == 0
    assert result.items == []
    assert result.pages == 0


def test_paginate_with_a_filter_counts_only_matching_rows(session):
    result = paginate(
        session.query(Thing).filter(Thing.name.like("item-1%")),
        PageParams(page=1, size=50),
    )
        # item-1, then item-10..item-19, then item-100..item-199
    assert result.total == 111
