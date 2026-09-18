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
from app.models.service import Service
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeRead, EmployeeListItem
from app.utils.media import process_image_content, get_upload_path
from app.core.security import get_password_hash
from app.core.upload_security import validate_image

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.post("/upload-image")
async def upload_employee_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_owner_or_manager),
):
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image(file, max_size=5 * 1024 * 1024)
    upload_dir = get_upload_path("profiles")
    filename = process_image_content(content, file.filename, upload_dir)
    return {"url": f"/uploads/profiles/{filename}"}

@router.get("", response_model=List[EmployeeListItem])
def list_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
    job_title: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    query = db.query(Employee).options(joinedload(Employee.assistant_of), joinedload(Employee.services))
    
    if job_title:
        query = query.filter(Employee.job_title == job_title)
    if status:
        query = query.filter(Employee.status == status)
    
    employees = query.order_by(Employee.display_order.asc(), Employee.id.desc()).all()
    
    # Map assistant_of name and service_ids
    for emp in employees:
        if emp.assistant_of:
            emp.assistant_of_name = emp.assistant_of.full_name
        emp.service_ids = [s.id for s in emp.services]
            
    return employees

@router.get("/archive", response_model=List[EmployeeListItem])
def list_archived_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=2000),
):
    """List archived employees (suspended/resigned). Owner and Manager can view."""
    archived_statuses = ["suspended", "resigned"]
    query = db.query(Employee).options(
        joinedload(Employee.assistant_of), joinedload(Employee.services)
    ).filter(Employee.status.in_(archived_statuses))

    if status and status in archived_statuses:
        query = query.filter(Employee.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Employee.full_name.ilike(like)) | (Employee.phone_primary.ilike(like))
        )

    employees = query.order_by(Employee.id.desc()).offset(skip).limit(limit).all()

    for emp in employees:
        if emp.assistant_of:
            emp.assistant_of_name = emp.assistant_of.full_name
        emp.service_ids = [s.id for s in emp.services]

    return employees


@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).options(
        joinedload(Employee.assistant_of), 
        joinedload(Employee.services)
    ).filter(Employee.id == employee_id).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    if employee.assistant_of:
        employee.assistant_of_name = employee.assistant_of.full_name
        
    return employee

@router.post("/{employee_id}/services")
def set_employee_services(
    employee_id: int,
    service_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    services = db.query(Service).filter(Service.id.in_(service_ids)).all()
    employee.services = services
    db.commit()
    return {"status": "success"}

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

    data = payload.model_dump(exclude={"username", "password", "role", "service_ids"}, exclude_unset=False)
    # Remove None service helper
    # Handle login account creation if requested
    username = payload.username
    password = payload.password
    role_val = payload.role

    linked_user_id = None
    if payload.has_login_account and username:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقاً")
        if not password:
            raise HTTPException(status_code=400, detail="كلمة المرور مطلوبة لحساب الدخول")
        new_user = User(
            username=username,
            hashed_password=get_password_hash(password),
            full_name=data.get("full_name"),
            role=role_val or "employee",
        )
        db.add(new_user)
        db.flush()  # get id
        linked_user_id = new_user.id
        data["user_id"] = linked_user_id
        # also link back via barber_id for convenience
        # new_user.barber_id will be set after employee creation

    employee = Employee(**{k: v for k, v in data.items() if hasattr(Employee, k)})
    db.add(employee)
    db.flush()
    # Link user -> employee if created
    if linked_user_id:
        usr = db.query(User).filter(User.id == linked_user_id).first()
        if usr:
            usr.barber_id = employee.id
    # Handle services if provided inline
    svc_ids = payload.service_ids or payload.model_dump().get("serviceIds")
    # also check raw serviceIds from alias
    if svc_ids:
        try:
            services = db.query(Service).filter(Service.id.in_(svc_ids)).all()
            employee.services = services
        except Exception:
            pass
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

    raw = payload.model_dump(exclude_unset=True)
    # Extract login-related fields before generic update
    username = raw.pop("username", None)
    password = raw.pop("password", None)
    role_val = raw.pop("role", None)
    svc_ids = raw.pop("service_ids", None)
    # also pop camel alias if present
    raw.pop("serviceIds", None)

    update_data = raw
    
    # Check assistant_of_barber_id
    if "assistant_of_barber_id" in update_data and update_data["assistant_of_barber_id"]:
        parent = db.query(Employee).filter(Employee.id == update_data["assistant_of_barber_id"]).first()
        if not parent:
            raise HTTPException(status_code=400, detail="الحلاق المسؤول غير موجود")

    for field, value in update_data.items():
        if hasattr(employee, field):
            setattr(employee, field, value)

    # Handle user account update/creation
    has_login = update_data.get("has_login_account", employee.has_login_account)
    if has_login:
        if employee.user_id:
            usr = db.query(User).filter(User.id == employee.user_id).first()
            if usr:
                if username:
                    # check uniqueness
                    exists = db.query(User).filter(User.username == username, User.id != usr.id).first()
                    if exists:
                        raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقاً")
                    usr.username = username
                if password:
                    usr.hashed_password = get_password_hash(password)
                if role_val:
                    usr.role = role_val
                usr.full_name = employee.full_name
                usr.barber_id = employee.id
        else:
            # create new user if username provided
            if username and password:
                exists = db.query(User).filter(User.username == username).first()
                if exists:
                    raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقاً")
                new_user = User(
                    username=username,
                    hashed_password=get_password_hash(password),
                    full_name=employee.full_name,
                    role=role_val or "employee",
                    barber_id=employee.id,
                )
                db.add(new_user)
                db.flush()
                employee.user_id = new_user.id
            elif username and not password:
                # allow creation without password? require it
                raise HTTPException(status_code=400, detail="كلمة المرور مطلوبة لإنشاء حساب الدخول")

    # Handle services linking if provided
    if svc_ids is not None:
        try:
            services = db.query(Service).filter(Service.id.in_(svc_ids)).all()
            employee.services = services
        except Exception:
            pass

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
