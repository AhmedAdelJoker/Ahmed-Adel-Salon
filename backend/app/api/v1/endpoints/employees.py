from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os
import uuid
import shutil

from app.db.session import get_db
from app.api.deps import require_owner_or_manager, require_any_staff
from app.models.employee import Employee
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeRead, EmployeeListItem

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.post("/upload-image")
def upload_employee_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_owner_or_manager),
):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="يجب أن يكون الملف صورة")
    
    # Ensure directory exists
    os.makedirs("uploads/profiles", exist_ok=True)
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join("uploads/profiles", filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return URL (relative to base URL)
    return {"url": f"/uploads/profiles/{filename}"}

@router.get("", response_model=List[EmployeeListItem])
def list_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    job_title: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    query = db.query(Employee).options(joinedload(Employee.assistant_of))
    
    if job_title:
        query = query.filter(Employee.job_title == job_title)
    if status:
        query = query.filter(Employee.status == status)
    
    employees = query.order_by(Employee.display_order.asc(), Employee.id.desc()).all()
    
    # Map assistant_of name
    for emp in employees:
        if emp.assistant_of:
            emp.assistant_of_name = emp.assistant_of.full_name
            
    return employees

@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    employee = db.query(Employee).options(joinedload(Employee.assistant_of)).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    if employee.assistant_of:
        employee.assistant_of_name = employee.assistant_of.full_name
        
    return employee

@router.post("", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # Check if assistant_of_barber_id exists if provided
    if payload.assistant_of_barber_id:
        parent = db.query(Employee).filter(Employee.id == payload.assistant_of_barber_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="الحلاق المسؤول غير موجود")

    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee

@router.put("/{employee_id}", response_model=EmployeeRead)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    update_data = payload.model_dump(exclude_unset=True)
    
    # Check assistant_of_barber_id
    if "assistant_of_barber_id" in update_data and update_data["assistant_of_barber_id"]:
        parent = db.query(Employee).filter(Employee.id == update_data["assistant_of_barber_id"]).first()
        if not parent:
            raise HTTPException(status_code=400, detail="الحلاق المسؤول غير موجود")

    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return employee

@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    db.delete(employee)
    db.commit()
    return None



