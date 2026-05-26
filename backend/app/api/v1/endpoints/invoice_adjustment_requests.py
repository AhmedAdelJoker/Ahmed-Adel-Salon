from __future__ import annotations
from fastapi.middleware.cors import CORSMiddleware

import json
from datetime import datetime
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
            raise ImportError(
                "Cannot import get_db. Please update invoice_adjustment_requests.py to use your project's DB dependency."
            ) from exc

router = APIRouter()


class AdjustmentRequestCreate(BaseModel):
    request_type: str = "discount"
    reason: str = ""
    notes: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None
    requested_values: Optional[Dict[str, Any]] = None
    manager_pin: Optional[str] = None


class AdjustmentDecision(BaseModel):
    manager_note: Optional[str] = None
    managerNote: Optional[str] = None
    manager_pin: Optional[str] = None


def _now() -> datetime:
    return datetime.utcnow()


def _dialect(db: Session) -> str:
    try:
        return str(db.bind.dialect.name).lower()
    except Exception:
        return ""


def _get_manager_pin(db: Session) -> str:
    try:
        # Try to get pin from BusinessSettings
        from app.models.business_settings import BusinessSettings
        settings = db.query(BusinessSettings).first()
        if settings and hasattr(settings, "manager_approval_pin"):
            return str(settings.manager_approval_pin or "1234")
    except Exception:
        pass
    return "1234"


def _apply_adjustment_to_invoice(db: Session, invoice_id: int, req_type: str, requested_values: Dict[str, Any]):
    from app.models.invoice import Invoice
    from decimal import Decimal
    
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return

    req_type = req_type.lower()
    if req_type == "void":
        invoice.status = "cancelled"
    elif req_type == "payment_method":
        new_pm = requested_values.get("new_value")
        if new_pm:
            invoice.payment_method = new_pm.lower()
    elif req_type == "discount":
        new_discount = requested_values.get("new_value")
        if new_discount is not None:
            try:
                val = Decimal(str(new_discount))
                invoice.discount_amount = val
                invoice.total_amount = (invoice.subtotal_amount or 0) - val
                invoice.final_amount = invoice.total_amount
            except Exception:
                pass
    db.add(invoice)


def _ensure_table(db: Session) -> None:
    dialect = _dialect(db)
    if dialect in {"mssql", "pyodbc", "sqlserver"}:
        ddl = """
        IF OBJECT_ID('invoice_adjustment_requests', 'U') IS NULL
        CREATE TABLE invoice_adjustment_requests (
            id INT IDENTITY(1,1) PRIMARY KEY,
            invoice_id INT NULL,
            request_type NVARCHAR(80) NOT NULL DEFAULT 'discount',
            reason NVARCHAR(MAX) NULL,
            notes NVARCHAR(MAX) NULL,
            old_values NVARCHAR(MAX) NULL,
            requested_values NVARCHAR(MAX) NULL,
            status NVARCHAR(40) NOT NULL DEFAULT 'pending',
            manager_note NVARCHAR(MAX) NULL,
            created_by_id INT NULL,
            created_by_name NVARCHAR(255) NULL,
            decided_by_id INT NULL,
            decided_by_name NVARCHAR(255) NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NULL,
            decided_at DATETIME2 NULL
        )
        """
    else:
        # SQLite: Add column if missing
        db.execute(text("""
        CREATE TABLE IF NOT EXISTS invoice_adjustment_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NULL,
            request_type VARCHAR(80) NOT NULL DEFAULT 'discount',
            reason TEXT NULL,
            notes TEXT NULL,
            old_values TEXT NULL,
            requested_values TEXT NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'pending',
            manager_note TEXT NULL,
            created_by_id INTEGER NULL,
            created_by_name VARCHAR(255) NULL,
            decided_by_id INTEGER NULL,
            decided_by_name VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL,
            decided_at DATETIME NULL
        )
        """))
        try:
            db.execute(text("ALTER TABLE invoice_adjustment_requests ADD COLUMN requested_values TEXT"))
        except Exception:
            pass
    db.commit()


def _row_to_dict(row: Any) -> Dict[str, Any]:
    data = dict(row._mapping) if hasattr(row, "_mapping") else dict(row)
    
    for key in ["old_values", "requested_values"]:
        raw = data.get(key)
        if isinstance(raw, str) and raw:
            try:
                data[key] = json.loads(raw)
            except Exception:
                data[key] = {"raw": raw}
        elif raw is None:
            data[key] = {}
            
    return data


def _get_request_or_404(db: Session, request_id: int) -> Dict[str, Any]:
    _ensure_table(db)
    row = db.execute(
        text("SELECT * FROM invoice_adjustment_requests WHERE id = :id"),
        {"id": request_id},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="طلب تعديل الفاتورة غير موجود")
    return _row_to_dict(row)


@router.get("/invoice-adjustment-requests")
def list_invoice_adjustment_requests(status: Optional[str] = None, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    _ensure_table(db)
    params: Dict[str, Any] = {}
    where = ""
    if status and status != "all":
        where = "WHERE LOWER(status) = LOWER(:status)"
        params["status"] = status
    rows = db.execute(
        text(f"SELECT * FROM invoice_adjustment_requests {where} ORDER BY created_at DESC, id DESC"),
        params,
    ).fetchall()
    return [_row_to_dict(row) for row in rows]


@router.post("/invoices/{invoice_id}/adjustment-requests")
async def create_invoice_adjustment_request(invoice_id: int, payload: AdjustmentRequestCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    _ensure_table(db)
    
    # Check invoice creation time
    from app.models.invoice import Invoice
    from datetime import timedelta
    
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
        
    invoice_time = invoice.created_at
    if not invoice_time:
         # Fallback if created_at is missing (shouldn't happen)
         pass
    else:
        # Check if more than 1 hour passed
        now = datetime.utcnow()
        # Handle timezone-aware vs naive
        if invoice_time.tzinfo:
            now = datetime.now(invoice_time.tzinfo)
            
        if now > (invoice_time + timedelta(hours=1)):
            raise HTTPException(
                status_code=400, 
                detail="لا يمكن تعديل الفاتورة بعد مرور أكثر من ساعة على إصدارها"
            )

    old_values_json = json.dumps(payload.old_values or {}, ensure_ascii=False)
    requested_values_json = json.dumps(payload.requested_values or {}, ensure_ascii=False)
    
    status = "pending"
    manager_note = None
    decided_at_clause = "NULL"
    
    if payload.manager_pin:
        if payload.manager_pin == _get_manager_pin(db):
            status = "approved"
            manager_note = "تم الاعتماد الفوري بواسطة كود المدير"
            decided_at_clause = "SYSUTCDATETIME()" if _dialect(db) in {"mssql", "pyodbc", "sqlserver"} else "CURRENT_TIMESTAMP"
        else:
            raise HTTPException(status_code=403, detail="كود الاعتماد غير صحيح")

    dialect = _dialect(db)
    if dialect in {"mssql", "pyodbc", "sqlserver"}:
        insert_sql = text(f"""
            INSERT INTO invoice_adjustment_requests
                (invoice_id, request_type, reason, notes, old_values, requested_values, status, manager_note, created_at, decided_at)
            OUTPUT INSERTED.id
            VALUES (:invoice_id, :request_type, :reason, :notes, :old_values, :requested_values, :status, :manager_note, SYSUTCDATETIME(), {decided_at_clause})
        """)
        new_id = db.execute(insert_sql, {
            "invoice_id": invoice_id,
            "request_type": payload.request_type,
            "reason": payload.reason,
            "notes": payload.notes,
            "old_values": old_values_json,
            "requested_values": requested_values_json,
            "status": status,
            "manager_note": manager_note
        }).scalar()
    else:
        db.execute(text(f"""
            INSERT INTO invoice_adjustment_requests
                (invoice_id, request_type, reason, notes, old_values, requested_values, status, manager_note, created_at, decided_at)
            VALUES (:invoice_id, :request_type, :reason, :notes, :old_values, :requested_values, :status, :manager_note, CURRENT_TIMESTAMP, {decided_at_clause})
        """), {
            "invoice_id": invoice_id,
            "request_type": payload.request_type,
            "reason": payload.reason,
            "notes": payload.notes,
            "old_values": old_values_json,
            "requested_values": requested_values_json,
            "status": status,
            "manager_note": manager_note
        })
        new_id = db.execute(text("SELECT last_insert_rowid() AS id")).scalar() if dialect == "sqlite" else None
    
    if status == "approved":
        _apply_adjustment_to_invoice(db, invoice_id, payload.request_type, payload.requested_values or {})

    db.commit()

    # Notify Manager via WebSocket
    try:
        from app.services.notification_service import notification_service
        payload_notif = {
            "invoice_id": invoice_id,
            "request_type": payload.request_type,
            "status": status,
            "request_id": int(new_id) if new_id else None
        }
        event_name = "invoice_adjustment_approved" if status == "approved" else "invoice_adjustment_requested"
        msg_text = f"تم تنفيذ تعديل فوري للفاتورة #{invoice_id}" if status == "approved" else f"طلب تعديل جديد للفاتورة #{invoice_id}"
        
        await notification_service.broadcast_event(event_name, payload_notif)
        await notification_service.notify_role(db, "manager", event_name, msg_text, payload_notif)
        await notification_service.notify_role(db, "owner", event_name, msg_text, payload_notif)
    except Exception:
        pass

    if new_id:
        return _get_request_or_404(db, int(new_id))
    return {"message": "تمت العملية بنجاح", "invoice_id": invoice_id, "status": status}


def _decide_request(request_id: int, status: str, payload: AdjustmentDecision, db: Session) -> Dict[str, Any]:
    current = _get_request_or_404(db, request_id)
    if str(current.get("status", "pending")).lower() != "pending":
        raise HTTPException(status_code=400, detail="لا يمكن تعديل قرار طلب سبق اعتماده أو رفضه")
    
    if status == "approved":
        expected_pin = _get_manager_pin(db)
        if payload.manager_pin != expected_pin:
            raise HTTPException(status_code=403, detail="كود الاعتماد غير صحيح")

    manager_note = payload.manager_note if payload.manager_note is not None else payload.managerNote
    dialect = _dialect(db)
    now_sql = "SYSUTCDATETIME()" if dialect in {"mssql", "pyodbc", "sqlserver"} else "CURRENT_TIMESTAMP"
    db.execute(text(f"""
        UPDATE invoice_adjustment_requests
        SET status = :status,
            manager_note = :manager_note,
            updated_at = {now_sql},
            decided_at = {now_sql}
        WHERE id = :id
    """), {"status": status, "manager_note": manager_note, "id": request_id})
    
    # Auto-execute changes on approval
    if status == "approved":
        invoice_id = current.get("invoice_id")
        req_type = str(current.get("request_type", ""))
        requested_values = current.get("requested_values", {})
        _apply_adjustment_to_invoice(db, invoice_id, req_type, requested_values)

    db.commit()
    return _get_request_or_404(db, request_id)


@router.post("/invoice-adjustment-requests/{request_id}/approve")
def approve_invoice_adjustment_request(request_id: int, payload: AdjustmentDecision, db: Session = Depends(get_db)) -> Dict[str, Any]:
    return _decide_request(request_id, "approved", payload, db)


@router.post("/invoice-adjustment-requests/{request_id}/reject")
def reject_invoice_adjustment_request(request_id: int, payload: AdjustmentDecision, db: Session = Depends(get_db)) -> Dict[str, Any]:
    return _decide_request(request_id, "rejected", payload, db)



