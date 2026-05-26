from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Any, List

from app.api import deps
from app.models.employee import Employee
from app.models.user import User
from app.models.invoice import Invoice
# Assuming we migrate InvoiceApproval and Attendance updates to SQLAlchemy as well

router = APIRouter()

# --- OWNER ONLY ENDPOINTS ---

@router.post("/staff", tags=["owner"])
def add_staff(
    staff_data: dict,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_superuser), # Superuser = Owner
) -> Any:
    """
    Owner adds a new employee, sets salary and commission.
    """
    # Logic to create User then Employee profile
    return {"status": "staff_created"}

@router.delete("/staff/{staff_id}", tags=["owner"])
def archive_staff(
    staff_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Soft delete: Move staff to archive for 1 year.
    """
    employee = db.query(Employee).filter(Employee.id == staff_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    employee.is_archived = True
    employee.archived_at = datetime.now()
    db.add(employee)
    db.commit()
    return {"status": "staff_archived"}

# --- MANAGER ENDPOINTS ---

@router.get("/approvals", tags=["manager"])
def get_pending_approvals(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Manager views pending invoice edit requests.
    """
    if current_user.role not in ["manager", "admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Logic to fetch from InvoiceApproval table
    return []

@router.post("/approvals/{request_id}/approve", tags=["manager"])
def approve_request(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Manager approves an invoice edit.
    """
    # Logic to update approval status and allow cashier edit
    return {"status": "approved"}

@router.post("/attendance", tags=["manager"])
def record_attendance(
    attendance_data: dict,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Manager records attendance, delays, and deductions.
    """
    # Logic to create/update Attendance record
    return {"status": "attendance_recorded"}



