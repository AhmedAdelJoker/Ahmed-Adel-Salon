from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os
import uuid
import shutil

from app.db.session import get_db
from app.api.deps import require_manage_employees, require_any_staff, require_view_employees
from app.models.employee import Employee
from app.models.service import Service
from app.models.user import User
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeRead,
    EmployeeListItem,
    EmployeePOSItem,
)
from app.utils.media import process_image_content, get_upload_path
from app.core.employee_rules import digits_only, is_service_provider_job_title
from app.core.security import get_password_hash, validate_password_strength
from app.core.rbac import can_access
from app.core.roles import UserRole, normalize_role
from app.core.upload_security import validate_image
from app.core.audit import audit_log

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


def _ensure_identity_is_free(
    db: Session,
    *,
    phone: Optional[str] = None,
    national_id: Optional[str] = None,
    exclude_id: Optional[int] = None,
) -> None:
    """One person, one primary number and one national id.

    Two employees sharing a number means attendance and payouts land against
    the wrong person, and two rows sharing a national id is the duplicate a
    payroll audit finds months later. 409 rather than 400: the request is
    well-formed, it just conflicts with a record that already exists, and the
    message says exactly which one so the owner can go look.

    `phone` and `national_id` are expected already normalized by the schema
    (digits only, English numerals); they are normalized again here so a direct
    caller cannot skip it.
    """
    if phone:
        digits = digits_only(phone)
        query = db.query(Employee).filter(Employee.phone_primary == digits)
        if exclude_id is not None:
            query = query.filter(Employee.id != exclude_id)
        holder = query.first()
        if holder:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"رقم الجوال مسجل بالفعل للموظف: {holder.full_name}",
            )

    if national_id:
        digits = digits_only(national_id)
        query = db.query(Employee).filter(Employee.national_id == digits)
        if exclude_id is not None:
            query = query.filter(Employee.id != exclude_id)
        holder = query.first()
        if holder:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"رقم الهوية مسجل بالفعل للموظف: {holder.full_name}",
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
    # Read-only roster: accountant's attendance/payroll/reports pages render
    # base_salary, so they need the list; HR writes stay manage-employees-only.
    current_user: User = Depends(require_view_employees),
    job_title: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
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
    # Free-text over name/phone/national id. Mirrors /employees/archive so the
    # two rosters answer the same "who is this number?" question; the
    # add-employee form uses it to catch a phone or a national id that is
    # already on file before saving.
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Employee.full_name.ilike(like))
            | (Employee.phone_primary.ilike(like))
            | (Employee.national_id.ilike(like))
        )
    
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
    current_user: User = Depends(require_view_employees),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=2000),
):
    """List archived employees (resigned only). Owner and Manager can view.

    An employee on leave (`suspended`) is NOT archived: the salon keeps them in
    the team list with a "في إجازة" badge, one tap away from coming back. The
    archive is for people who left (`resigned`).
    """
    archived_statuses = ["resigned"]
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


def _slim_active_staff(db: Session, limit: int, *, pos_visible_only: bool) -> list:
    """Active staff rows for operational surfaces, payroll-free.

    Shared by ``GET /employees/pos`` (till: honors the owner-controlled
    ``show_in_pos`` toggle) and ``GET /employees/active`` (bookings board:
    every assignable staff member, incl. staff hidden from the public
    online-booking site).
    """
    filters = [Employee.is_active == True, Employee.status == "active"]  # noqa: E712
    if pos_visible_only:
        filters.append(Employee.show_in_pos == True)  # noqa: E712

    employees = (
        db.query(Employee)
        .options(joinedload(Employee.services))
        .filter(*filters)
        .order_by(Employee.display_order.asc(), Employee.id.desc())
        .limit(limit)
        .all()
    )

    for emp in employees:
        emp.service_ids = [s.id for s in emp.services]

    return employees


@router.get("/pos", response_model=List[EmployeePOSItem])
def list_pos_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    limit: int = Query(500, ge=1, le=2000),
):
    """Active staff for the POS terminal.

    The till must load for cashiers and barbers, but ``GET /employees`` carries
    payroll data (base_salary, commission_rate) and stays manage-employees-only.
    This returns identity + service links only, honoring the owner-controlled
    ``show_in_pos`` toggle ("الظهور في نقطة البيع") from the HR form.
    """
    return _slim_active_staff(db, limit, pos_visible_only=True)


@router.get("/active", response_model=List[EmployeePOSItem])
def list_active_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    limit: int = Query(500, ge=1, le=2000),
):
    """All currently working staff, for the internal bookings board.

    Deliberately no ``show_in_pos``/``show_in_booking`` filter: those toggles
    govern customer-facing surfaces (till, public online booking), while the
    board is where front desk assigns walk-ins — hiding a barber there because
    they are switched off for online booking would block walk-in assignment.
    """
    return _slim_active_staff(db, limit, pos_visible_only=False)


@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_view_employees),
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

    # The booking switch is owner intent *within* a classification: a manager,
    # accountant or assistant never reaches the public site even if the switch
    # was left on through a mis-click. The classification is server-side so a
    # direct API call cannot bypass it either.
    data["show_in_booking"] = bool(data.get("show_in_booking")) and is_service_provider_job_title(
        data.get("job_title")
    )

    # Request-shape validation first (pure, no DB): a weak password must be
    # reported as 400 even when the payload also conflicts with an existing
    # row — otherwise the 409 masks the user's actual mistake.
    username = (payload.username or "").strip() or None
    password = payload.password
    assigned_role = None
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
            "barber" if is_service_provider_job_title(data.get("job_title")) else "cashier"
        )
        assigned_role = _assignable_role(payload.role, current_user, default_role)

    # Identity conflicts next, before a login user is created or any row is
    # touched: a 409 must leave nothing half-written behind it.
    _ensure_identity_is_free(
        db,
        phone=data.get("phone_primary"),
        national_id=data.get("national_id"),
    )

    linked_user_id = None
    if payload.has_login_account:
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

    # An update must not be the side door around the create path's uniqueness —
    # and a number may collide with someone *other* than the row being edited,
    # hence the exclusion.
    _ensure_identity_is_free(
        db,
        phone=update_data.get("phone_primary"),
        national_id=update_data.get("national_id"),
        exclude_id=employee.id,
    )
    
    # Check assistant_of_barber_id
    if "assistant_of_barber_id" in update_data and update_data["assistant_of_barber_id"]:
        parent = db.query(Employee).filter(Employee.id == update_data["assistant_of_barber_id"]).first()
        if not parent:
            raise HTTPException(status_code=400, detail="الحلاق المسؤول غير موجود")

    for field, value in update_data.items():
        if hasattr(employee, field):
            setattr(employee, field, value)

    # Same classification as create: whatever the payload said, a non-service
    # title can not stay visible for online booking — this also self-heals rows
    # saved before the rule existed.
    employee.show_in_booking = bool(employee.show_in_booking) and is_service_provider_job_title(
        employee.job_title
    )

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
                if is_service_provider_job_title(employee.job_title)
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
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    _ensure_employee_mutable(db, employee, current_user)

    # Snapshot before delete — after `db.delete()` the ORM state is expunged.
    snapshot = {
        "full_name": employee.full_name,
        "job_title": employee.job_title,
        "phone": employee.phone_primary,
    }
    db.delete(employee)
    db.commit()
    audit_log(
        db, request, current_user,
        action="delete_employee",
        entity_type="employee",
        entity_id=employee_id,
        description={"deleted": snapshot},
    )
    return None
