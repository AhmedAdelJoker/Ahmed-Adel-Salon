from __future__ import annotations
from fastapi.middleware.cors import CORSMiddleware

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import require_owner_or_manager
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/employee-reports", tags=["Employee Reports"])


def _num(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except Exception:
        return 0.0


def _table_exists(db: Session, table_name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).first()
    return row is not None


def _rows(db: Session, sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    return [dict(row._mapping) for row in db.execute(text(sql), params).all()]


def _scalar(db: Session, sql: str, params: dict[str, Any]) -> Any:
    return db.execute(text(sql), params).scalar()


@router.get("/summary")
def get_employee_report_summary(
    employee_id: int = Query(..., gt=0),
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.execute(
        text("""
            SELECT id, full_name, display_name, job_title, department, status,
                   base_salary, commission_rate, fixed_bonus, default_deductions,
                   payment_method, wallet_number, bank_account, hire_date
            FROM employees
            WHERE id = :employee_id
        """),
        {"employee_id": employee_id},
    ).mappings().first()

    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    now = datetime.now()
    month = month or now.month
    year = year or now.year
    params = {"employee_id": employee_id, "month": month, "year": year}

    payroll_rows = []
    latest_payroll = None
    payroll_totals = {
        "base_salary": 0.0,
        "commission_amount": 0.0,
        "bonus_amount": 0.0,
        "deduction_amount": 0.0,
        "advance_amount": 0.0,
        "net_salary": 0.0,
        "paid_total": 0.0,
        "unpaid_total": 0.0,
    }

    if _table_exists(db, "payroll_records"):
        payroll_rows = _rows(
            db,
            """
            SELECT * FROM payroll_records
            WHERE employee_id = :employee_id
              AND period_month = :month
              AND period_year = :year
            ORDER BY id DESC
            """,
            params,
        )
        latest_payroll = payroll_rows[0] if payroll_rows else None
        for row in payroll_rows:
            payroll_totals["base_salary"] += _num(row.get("base_salary"))
            payroll_totals["commission_amount"] += _num(row.get("commission_amount"))
            payroll_totals["bonus_amount"] += _num(row.get("bonus_amount"))
            payroll_totals["deduction_amount"] += _num(row.get("deduction_amount"))
            payroll_totals["advance_amount"] += _num(row.get("advance_amount"))
            payroll_totals["net_salary"] += _num(row.get("net_salary"))
            if row.get("status") == "paid":
                payroll_totals["paid_total"] += _num(row.get("net_salary"))
            else:
                payroll_totals["unpaid_total"] += _num(row.get("net_salary"))

    advance_rows = []
    open_total = 0.0
    deducted_total = 0.0
    if _table_exists(db, "salary_advances"):
        advance_rows = _rows(
            db,
            """
            SELECT * FROM salary_advances
            WHERE employee_id = :employee_id
            ORDER BY advance_date DESC, id DESC
            """,
            params,
        )
        for row in advance_rows:
            if bool(row.get("is_deducted")):
                deducted_total += _num(row.get("amount"))
            else:
                open_total += _num(row.get("amount"))

    attendance = {
        "total_logs": 0,
        "check_ins": 0,
        "check_outs": 0,
        "current_status": None,
        "last_seen_at": None,
    }
    if _table_exists(db, "employee_presence_logs"):
        attendance["total_logs"] = int(_scalar(db, "SELECT COUNT(*) FROM employee_presence_logs WHERE employee_id=:employee_id", params) or 0)
        attendance["check_ins"] = int(_scalar(db, "SELECT COUNT(*) FROM employee_presence_logs WHERE employee_id=:employee_id AND status='in'", params) or 0)
        attendance["check_outs"] = int(_scalar(db, "SELECT COUNT(*) FROM employee_presence_logs WHERE employee_id=:employee_id AND status='out'", params) or 0)
        last_log = db.execute(
            text("""
                SELECT status, created_at FROM employee_presence_logs
                WHERE employee_id = :employee_id
                ORDER BY created_at DESC, id DESC
                LIMIT 1
            """),
            params,
        ).mappings().first()
        if last_log:
            attendance["current_status"] = last_log.get("status")
            attendance["last_seen_at"] = last_log.get("created_at")

    return {
        "period": {"month": month, "year": year},
        "employee": dict(employee),
        "payroll": {"latest": latest_payroll, "rows": payroll_rows, "totals": payroll_totals},
        "advances": {"rows": advance_rows, "open_total": open_total, "deducted_total": deducted_total},
        "attendance": attendance,
    }



