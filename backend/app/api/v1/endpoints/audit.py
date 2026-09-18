from datetime import datetime
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.schemas.core_business import AuditLogOut
from app.crud.core_business import list_audit_logs

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/", response_model=list[AuditLogOut])
def read_audit_logs(
    response: Response = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    skip: int = Query(0, ge=0, description="Alias for offset"),
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=500),
    sort: str | None = Query(None, description="Sort field. '-' prefix for DESC"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_owner),
):
    # Phase 2: normalize page/page_size → offset/limit
    eff_offset = offset
    eff_limit = limit
    if page is not None and page_size is not None:
        eff_offset = (page - 1) * page_size
        eff_limit = page_size
    elif skip > 0:
        eff_offset = skip

    # Phase 2: call returns (rows, total) tuple now
    from sqlalchemy.orm import Query
    rows, total = list_audit_logs(db, limit=eff_limit, offset=eff_offset)

    # Phase 2: X-Total-Count headers
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)
    return rows
