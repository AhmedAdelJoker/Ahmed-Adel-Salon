"""
Pagination — phase 2 utility for scalable list endpoints.

Provides:
  - PageParams: a FastAPI dependency that parses ?page=&size=&sort=
  - Page schema: standard envelope { items, total, page, size, pages }
  - paginate(): a one-call helper that applies offset/limit + count to a query

Usage:
    @router.get("/items")
    def list_items(params: PageParams = Depends(), db: Session = Depends(get_db)):
        query = db.query(Item)
        result = paginate(query, params)
        return result.dict()
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, List, Optional, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Query as SAQuery

T = TypeVar("T")


class PageParams:
    """FastAPI dependency — query-string pagination."""

    def __init__(
        self,
        page: int = Query(1, ge=1, le=10_000, description="1-indexed page number"),
        size: int = Query(
            25, ge=1, le=200, description="Items per page (max 200)"
        ),
        sort: Optional[str] = Query(
            None,
            description="Sort field. Prefix with '-' for DESC. Examples: 'created_at', '-name'",
        ),
    ) -> None:
        self.page = page
        self.size = size
        self.offset = (page - 1) * size
        self.sort = sort

    @property
    def sort_field(self) -> Optional[str]:
        """Return the field name without the '-' prefix."""
        if not self.sort:
            return None
        return self.sort.lstrip("-")

    @property
    def sort_desc(self) -> bool:
        return bool(self.sort and self.sort.startswith("-"))


@dataclass
class PageResult(Generic[T]):
    """Standard envelope returned by `paginate()`."""
    items: Sequence[T]
    total: int
    page: int
    size: int
    pages: int

    def dict(self) -> dict:
        return {
            "items": list(self.items),
            "total": self.total,
            "page": self.page,
            "size": self.size,
            "pages": self.pages,
        }


def paginate(
    query: SAQuery,
    params: PageParams,
    *,
    sort_columns: dict | None = None,
) -> PageResult:
    """Apply pagination + sorting + counting to a SQLAlchemy Query.

    Args:
        query: SA Query to paginate
        params: parsed PageParams from FastAPI
        sort_columns: optional mapping of public sort names -> ORM columns
                       (e.g. {"name": Customer.name, "created_at": Customer.created_at})
    """
    # Sorting
    if params.sort:
        column = None
        if sort_columns and params.sort_field in sort_columns:
            column = sort_columns[params.sort_field]
        else:
            # Try the field as an attribute of the queried entity
            try:
                column = getattr(query.column_descriptions[0]["entity"], params.sort_field)
            except (AttributeError, KeyError, IndexError):
                column = None

        if column is not None:
            if params.sort_desc:
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column.asc())

    total = query.count()
    items = query.offset(params.offset).limit(params.size).all()
    pages = (total + params.size - 1) // params.size if params.size else 1

    return PageResult(
        items=items,
        total=total,
        page=params.page,
        size=params.size,
        pages=pages,
    )


# ---------------------------------------------------------------------------
# Optional pydantic envelope — for endpoints that want schema validation
# ---------------------------------------------------------------------------
class Page(BaseModel, Generic[T]):
    items: List[T] = Field(default_factory=list)
    total: int
    page: int
    size: int
    pages: int
