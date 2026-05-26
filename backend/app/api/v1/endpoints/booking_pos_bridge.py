from __future__ import annotations
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

try:
    from app.db.session import get_db  # type: ignore
except Exception:
    try:
        from app.database import get_db  # type: ignore
    except Exception:
        try:
            from app.core.database import get_db  # type: ignore
        except Exception as exc:
            raise ImportError("Cannot import get_db for booking_pos_bridge") from exc

router = APIRouter()

BOOKING_TABLE_CANDIDATES = ["appointments", "bookings", "booking", "appointments_table"]
STATUS_READY = {"completed", "ready_for_payment", "ready_for_pos", "ready", "finished"}
STATUS_ACTIVE = {"started", "in_progress", "serving", "active"}
STATUS_PAID = {"paid", "invoiced", "closed"}


class MarkPaidPayload(BaseModel):
    invoice_id: Optional[int] = None
    invoiceId: Optional[int] = None


def _dialect(db: Session) -> str:
    try:
        return str(db.bind.dialect.name).lower()
    except Exception:
        return ""


def _table_exists(db: Session, table_name: str) -> bool:
    dialect = _dialect(db)
    if dialect == "sqlite":
        row = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"), {"name": table_name}).first()
        return row is not None
    if dialect in {"mssql", "pyodbc", "sqlserver"}:
        row = db.execute(text("SELECT OBJECT_ID(:name, 'U')"), {"name": table_name}).scalar()
        return row is not None
    try:
        db.execute(text(f"SELECT 1 FROM {table_name} WHERE 1=0"))
        return True
    except Exception:
        return False


def _columns(db: Session, table_name: str) -> List[str]:
    dialect = _dialect(db)
    if dialect == "sqlite":
        rows = db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
        return [str(row[1]) for row in rows]
    if dialect in {"mssql", "pyodbc", "sqlserver"}:
        rows = db.execute(text("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=:table"), {"table": table_name}).fetchall()
        return [str(row[0]) for row in rows]
    return []


def _find_booking_table(db: Session) -> str:
    for table in BOOKING_TABLE_CANDIDATES:
        if _table_exists(db, table):
            return table
    raise HTTPException(status_code=500, detail="لم يتم العثور على جدول الحجوزات/المواعيد")


def _first(cols: List[str], candidates: List[str]) -> Optional[str]:
    lower_map = {c.lower(): c for c in cols}
    for item in candidates:
        if item.lower() in lower_map:
            return lower_map[item.lower()]
    return None


def _status_col(cols: List[str]) -> Optional[str]:
    return _first(cols, ["status", "state", "appointment_status", "booking_status"])


def _id_col(cols: List[str]) -> str:
    return _first(cols, ["id", "appointment_id", "booking_id"]) or "id"


def _select_expr(cols: List[str], candidates: List[str], alias: str, fallback: str = "NULL") -> str:
    col = _first(cols, candidates)
    if col:
        return f"{col} AS {alias}"
    return f"{fallback} AS {alias}"


def _normalize_row(row: Any) -> Dict[str, Any]:
    data = dict(row._mapping) if hasattr(row, "_mapping") else dict(row)
    return data


def _row_by_id(db: Session, table: str, cols: List[str], booking_id: int) -> Dict[str, Any]:
    id_col = _id_col(cols)
    row = db.execute(text(f"SELECT * FROM {table} WHERE {id_col}=:id"), {"id": booking_id}).first()
    if not row:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    return _normalize_row(row)


def _update_status(db: Session, booking_id: int, target_status: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    table = _find_booking_table(db)
    cols = _columns(db, table)
    id_col = _id_col(cols)
    status_col = _status_col(cols)
    if not status_col:
        raise HTTPException(status_code=500, detail="جدول الحجوزات لا يحتوي على عمود حالة")

    updates = [f"{status_col}=:status"]
    params: Dict[str, Any] = {"status": target_status, "id": booking_id}

    if "updated_at" in cols:
        now_expr = "CURRENT_TIMESTAMP" if _dialect(db) == "sqlite" else "SYSUTCDATETIME()"
        updates.append(f"updated_at={now_expr}")

    extra = extra or {}
    invoice_id = extra.get("invoice_id")
    invoice_col = _first(cols, ["invoice_id", "invoiceId"])
    if invoice_col and invoice_id is not None:
        updates.append(f"{invoice_col}=:invoice_id")
        params["invoice_id"] = invoice_id

    db.execute(text(f"UPDATE {table} SET {', '.join(updates)} WHERE {id_col}=:id"), params)
    db.commit()
    return _row_by_id(db, table, cols, booking_id)


@router.get("/bookings/ready-for-pos")
def ready_for_pos_bookings(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    table = _find_booking_table(db)
    cols = _columns(db, table)
    id_col = _id_col(cols)
    status_col = _status_col(cols)

    select_parts = [
        f"{id_col} AS id",
        _select_expr(cols, ["customer_id", "client_id"], "customer_id"),
        _select_expr(cols, ["customer_name", "client_name", "name"], "customer_name", "''"),
        _select_expr(cols, ["service_id"], "service_id"),
        _select_expr(cols, ["service_name", "service"], "service_name", "''"),
        _select_expr(cols, ["employee_id", "barber_id", "staff_id"], "employee_id"),
        _select_expr(cols, ["employee_name", "barber_name", "staff_name"], "employee_name", "''"),
        _select_expr(cols, ["price", "amount", "total", "total_amount"], "amount", "0"),
        _select_expr(cols, ["start_time", "appointment_time", "booking_time", "date", "created_at"], "booking_time"),
    ]
    if status_col:
        select_parts.append(f"{status_col} AS status")
        placeholders = ", ".join([f":s{i}" for i, _ in enumerate(STATUS_READY)])
        params = {f"s{i}": status for i, status in enumerate(STATUS_READY)}
        sql = f"SELECT {', '.join(select_parts)} FROM {table} WHERE LOWER({status_col}) IN ({placeholders}) ORDER BY {id_col} DESC"
        rows = db.execute(text(sql), params).fetchall()
    else:
        select_parts.append("'' AS status")
        rows = db.execute(text(f"SELECT {', '.join(select_parts)} FROM {table} ORDER BY {id_col} DESC")).fetchall()
    return [_normalize_row(row) for row in rows]


@router.post("/bookings/{booking_id}/start-service")
def start_service(booking_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    return _update_status(db, booking_id, "in_progress")


@router.post("/bookings/{booking_id}/complete-service")
def complete_service(booking_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    return _update_status(db, booking_id, "ready_for_pos")


@router.post("/bookings/{booking_id}/mark-paid")
def mark_paid(booking_id: int, payload: MarkPaidPayload, db: Session = Depends(get_db)) -> Dict[str, Any]:
    invoice_id = payload.invoice_id if payload.invoice_id is not None else payload.invoiceId
    return _update_status(db, booking_id, "paid", {"invoice_id": invoice_id})



