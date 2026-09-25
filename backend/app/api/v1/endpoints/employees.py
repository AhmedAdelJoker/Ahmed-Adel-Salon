from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os
import uuid
import shutil

from app.db.session import get_db
from app.api.deps import require_manage_employees
from app.models.employee import Employee
from app.models.service import Service
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeRead, EmployeeListItem
from app.utils.media import process_image_content, get_upload_path
from app.core.security import get_password_hash, validate_password_strength
from app.core.rbac import can_access
from app.core.roles import UserRole, normalize_role
from app.core.upload_security import validate_image

router = APIRouter(prefix="/employees", tags=["Employees"])

ALLOWED_USER_ROLE_VALUES = {role.value for role in UserRole}


def _assignable_role(
    requested_role: str | None,
    current_user: User,
    default_role: str = "cashier",
) -> str:
    normalized = normalize_role(requested_role or default_role)
    if normalized not in ALLOWED_USER_ROLE_VALUES:
        raise HTTPException(status_code=400, detail="الدور غير صالح")
    if not can_access(normalized, current_user.role):
        raise HTTPException(
            status_code=403,
            detail="لا يمكنك تعيين دور أعلى من دورك",
        )
    return normalized


def _bump_token_version(user: User) -> None:
    user.token_version = int(user.token_version or 0) + 1


def _ensure_employee_mutable(
    db: Session,
    employee: Employee,
    current_user: User,
) -> None:
    if not employee.user_id:
        return
    linked_user = db.query(User).filter(User.id == employee.user_id).first()
    if linked_user and not can_access(linked_user.role, current_user.role):
        raise HTTPException(
            status_code=403,
            detail="لا يمكنك تعديل موظف مرتبط بدور أعلى من دورك",
        )

@router.post("/upload-image")
async def upload_employee_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_manage_employees),
):
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image(file, max_size=5 * 1024 * 1024)
    upload_dir = get_upload_path("profiles")
    filename = process_image_content(content, file.filename, upload_dir)
    return {"url": f"/uploads/profiles/{filename}"}

@router.get("", response_model=List[EmployeeListItem])
def list_employees(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
    job_title: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(2000, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=2000),
):
    query = db.query(Employee).options(joinedload(Employee.assistant_of), joinedload(Employee.services))
    
    if job_title:
        query = query.filter(Employee.job_title == job_title)
    if status:
        query = query.filter(Employee.status == status)
    
    eff_offset = offset
    eff_limit = limit
    if page is not None and page_size is not None:
        eff_offset = (page - 1) * page_size
        eff_limit = page_size

    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)

    employees = (
        query.order_by(Employee.display_order.asc(), Employee.id.desc())
        .offset(eff_offset)
        .limit(eff_limit)
        .all()
    )
    
    # Map assistant_of name and service_ids
    for emp in employees:
        if emp.assistant_of:
            emp.assistant_of_name = emp.assistant_of.full_name
        emp.service_ids = [s.id for s in emp.services]
            
    return employees

@router.get("/archive", response_model=List[EmployeeListItem])
def list_archived_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
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
    current_user: User = Depends(require_manage_employees),
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
    current_user: User = Depends(require_manage_employees),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    _ensure_employee_mutable(db, employee, current_user)
    
    services = db.query(Service).filter(Service.id.in_(service_ids)).all()
    employee.services = services
    db.commit()
    return {"status": "success"}

@router.post("", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    # Check if assistant_of_barber_id exists if provided
    if payload.assistant_of_barber_id:
        parent = db.query(Employee).filter(Employee.id == payload.assistant_of_barber_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="الحلاق المسؤول غير موجود")

    data = payload.model_dump(
        exclude={"username", "password", "role", "service_ids"},
        exclude_unset=False,
    )
    username = (payload.username or "").strip() or None
    password = payload.password

    linked_user_id = None
    if payload.has_login_account:
        if not username:
            raise HTTPException(status_code=400, detail="اسم المستخدم مطلوب لحساب الدخول")
        if not password:
            raise HTTPException(status_code=400, detail="كلمة المرور مطلوبة لحساب الدخول")
        try:
            password = validate_password_strength(password)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        default_role = (
            "barber"
            if str(data.get("job_title") or "").strip().lower() == "barber"
            else "cashier"
        )
        assigned_role = _assignable_role(payload.role, current_user, default_role)
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقاً")
        new_user = User(
            username=username,
            hashed_password=get_password_hash(password),
            full_name=data.get("full_name"),
            role=assigned_role,
        )
        db.add(new_user)
        db.flush()
        linked_user_id = new_user.id
        data["user_id"] = linked_user_id

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
    current_user: User = Depends(require_manage_employees),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    _ensure_employee_mutable(db, employee, current_user)

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

    has_login = update_data.get("has_login_account", employee.has_login_account)
    if has_login:
        if employee.user_id:
            usr = db.query(User).filter(User.id == employee.user_id).first()
            if usr:
                if not can_access(usr.role, current_user.role):
                    raise HTTPException(
                        status_code=403,
                        detail="لا يمكنك تعديل مستخدم بدور أعلى من دورك",
                    )
                if username:
                    username = username.strip()
                    if not username:
                        raise HTTPException(status_code=400, detail="اسم المستخدم مطلوب")
                    exists = db.query(User).filter(
                        User.username == username,
                        User.id != usr.id,
                    ).first()
                    if exists:
                        raise HTTPException(
                            status_code=400,
                            detail="اسم المستخدم موجود مسبقاً",
                        )
                    usr.username = username
                if password:
                    try:
                        password = validate_password_strength(password)
                    except ValueError as exc:
                        raise HTTPException(status_code=400, detail=str(exc))
                    usr.hashed_password = get_password_hash(password)
                    _bump_token_version(usr)
                if role_val:
                    assigned_role = _assignable_role(role_val, current_user)
                    if assigned_role != normalize_role(usr.role):
                        usr.role = assigned_role
                        _bump_token_version(usr)
                usr.full_name = employee.full_name
                usr.barber_id = employee.id
        else:
            if not username or not password:
                raise HTTPException(
                    status_code=400,
                    detail="اسم المستخدم وكلمة المرور مطلوبان لإنشاء حساب الدخول",
                )
            username = username.strip()
            try:
                password = validate_password_strength(password)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))
            default_role = (
                "barber"
                if str(employee.job_title or "").strip().lower() == "barber"
                else "cashier"
            )
            assigned_role = _assignable_role(role_val, current_user, default_role)
            exists = db.query(User).filter(User.username == username).first()
            if exists:
                raise HTTPException(
                    status_code=400,
                    detail="اسم المستخدم موجود مسبقاً",
                )
            new_user = User(
                username=username,
                hashed_password=get_password_hash(password),
                full_name=employee.full_name,
                role=assigned_role,
                barber_id=employee.id,
            )
            db.add(new_user)
            db.flush()
            employee.user_id = new_user.id

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
    current_user: User = Depends(require_manage_employees),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    _ensure_employee_mutable(db, employee, current_user)

    db.delete(employee)
    db.commit()
    return None
