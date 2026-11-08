from datetime import date as _date, datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os
import uuid
import shutil

from app.db.session import get_db
from app.api.deps import require_manage_employees, require_any_staff, require_view_employees
from app.core.booking_status import holds_barber_time
from app.core.clock import salon_day_bounds_utc, salon_now, utc_now_naive, utc_to_salon_naive
from app.models.appointment import Appointment
from app.models.employee import Employee
from app.models.service import Service
from app.models.user import User
from app.schemas.employee import (
    EmployeeArchiveRequest,
    EmployeeCreate,
    EmployeeStats,
    EmployeeUpdate,
    EmployeeRead,
    EmployeeListItem,
    EmployeePOSItem,
)
from app.utils.media import process_image_content, get_upload_path
from app.core.employee_rules import (
    SERVICE_PROVIDER_JOB_TITLES,
    digits_only,
    is_service_provider_job_title,
)
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
    # The team list wants "everyone except the people who left", and a single
    # `status` value cannot say that. Filtering `resigned` out client-side while
    # paging server-side means a page of 50 rows arrives with some of them
    # dropped and the count above it disagrees with the list below it.
    exclude_status: Optional[str] = Query(None, alias="excludeStatus"),
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
    if exclude_status:
        query = query.filter(Employee.status != exclude_status)
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
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_view_employees),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    reason: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=2000),
):
    """List archived employees (resigned only). Owner and Manager can view.

    An employee on leave (`suspended`) is NOT archived: the salon keeps them in
    the team list with a "في إجازة" badge, one tap away from coming back. The
    archive is for people who left (`resigned`).

    Most recent departure first. Rows that left before the archive kept a date
    sort after every dated one rather than posing as the newest leaver, and the
    total goes out as `X-Total-Count` so the page can page without pulling a
    thousand rows to find out how many there are.
    """
    archived_statuses = ["resigned"]
    query = db.query(Employee).options(
        joinedload(Employee.assistant_of), joinedload(Employee.services)
    ).filter(Employee.status.in_(archived_statuses))

    if status and status in archived_statuses:
        query = query.filter(Employee.status == status)
    if reason:
        query = query.filter(Employee.archive_reason == reason)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Employee.full_name.ilike(like))
            | (Employee.phone_primary.ilike(like))
            | (Employee.archive_reason.ilike(like))
        )

    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)

    employees = (
        query.order_by(
            case((Employee.archived_at.is_(None), 1), else_=0).asc(),
            Employee.archived_at.desc(),
            Employee.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    for emp in employees:
        if emp.assistant_of:
            emp.assistant_of_name = emp.assistant_of.full_name
        emp.service_ids = [s.id for s in emp.services]
        # The day they left, in the shop's own calendar. `archived_at` is a UTC
        # instant -- Cairo midnight is 21:00 or 22:00 UTC the day before -- and a
        # browser asked to print one prints *its* day, so a raw timestamp lands
        # a day early for a reader in another zone. The page shows a date, so it
        # gets the shop's date.
        emp.archived_on = (
            utc_to_salon_naive(emp.archived_at).date() if emp.archived_at else None
        )

    return employees


@router.get("/stats", response_model=EmployeeStats)
def employee_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_view_employees),
):
    """Roster counts for the whole team, not for one page of it.

    The HR board computed "total staff" from the 50 rows it was showing, so the
    headline moved when the owner turned the page. One grouped query per number,
    over the whole table, so the board and the pagination agree.
    """
    by_status = dict(
        db.query(Employee.status, func.count(Employee.id)).group_by(Employee.status).all()
    )
    service_providers = list(SERVICE_PROVIDER_JOB_TITLES)

    def _count(*conditions):
        return (
            db.query(func.count(Employee.id)).filter(*conditions).scalar() or 0
        )

    return EmployeeStats(
        total=_count(),
        active=by_status.get("active", 0),
        suspended=by_status.get("suspended", 0),
        resigned=by_status.get("resigned", 0),
        barbers=_count(
            Employee.job_title.in_(service_providers), Employee.status == "active"
        ),
        assistants=_count(
            Employee.job_title == "barber_assistant", Employee.status == "active"
        ),
    )


@router.get("/{employee_id}/archive-impact")
def employee_archive_impact(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_view_employees),
):
    """What archiving this person would touch, before anyone decides to do it.

    The archive is the one HR action that can strand a customer: a leaver with
    bookings still holding their chair does not disappear just because the row
    moved. The count is read here so the dialog can say it out loud *before*
    the owner presses archive, rather than after someone calls to ask where
    their appointment went.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    day = salon_now().date()
    future_appointments = (
        db.query(func.count(Appointment.id))
        .filter(
            Appointment.barber_id == employee_id,
            Appointment.appointment_date >= day,
            holds_barber_time(),
        )
        .scalar()
        or 0
    )

    linked_role = None
    if employee.user_id:
        usr = db.query(User).filter(User.id == employee.user_id).first()
        if usr:
            linked_role = usr.role

    return {
        "id": employee.id,
        "fullName": employee.full_name,
        "status": employee.status,
        "futureAppointments": future_appointments,
        "hasLoginAccount": bool(employee.user_id),
        "linkedUserRole": linked_role,
        "showInPos": bool(employee.show_in_pos),
        "showInBooking": bool(employee.show_in_booking),
        "archivedAt": employee.archived_at,
        "archiveReason": employee.archive_reason,
    }


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

    # Leaving is an event with a date, a reason and a person who decided, and
    # `POST /employees/{id}/archive` is the only path that records all three.
    # Letting a plain field write flip `resigned` would keep producing archive
    # rows with no departure date -- the exact blank this migration added the
    # columns to fill.
    if update_data.get("status") == "resigned":
        raise HTTPException(
            status_code=400,
            detail="الأرشفة تتم من إجراء أرشفة الموظف حتى يسجل تاريخ الخروج والسبب ومن قرر",
        )

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

def _set_staff_login_enabled(db: Session, employee: Employee, *, enabled: bool) -> bool:
    """Open or close the staff login that travels with an employee row.

    Archiving used to leave it standing: the person had left the salon, their
    `users` row kept `is_active`, and every token they had already minted stayed
    usable. Rotation on the way out kills those sessions; restoring re-opens the
    account only because an owner asked for the person back by name.
    """
    if not employee.user_id:
        return False
    usr = db.query(User).filter(User.id == employee.user_id).first()
    if not usr:
        return False
    usr.is_active = enabled
    if not enabled:
        usr.token_version = int(usr.token_version or 0) + 1
    db.add(usr)
    return True


def _archive_instant(effective_date: Optional[_date], hire_date: Optional[datetime]) -> datetime:
    """The instant to store as `archived_at` for an agreed last working day.

    Kept as the shop's own midnight expressed in UTC, which is what every other
    boundary in this codebase stores. A future date is rejected rather than
    stored: leaving is a fact about a day that has happened, and a `resigned`
    row with a future date silently hides the employee from today's schedule
    while the owner believes they still have a shift to cover.
    """
    if effective_date is None:
        return utc_now_naive()
    today = salon_now().date()
    if effective_date > today:
        raise HTTPException(
            status_code=400,
            detail="تاريخ آخر يوم عمل لا يمكن أن يكون في المستقبل",
        )
    if hire_date is not None and effective_date < hire_date.date():
        raise HTTPException(
            status_code=400,
            detail="تاريخ آخر يوم عمل لا يمكن أن يسبق تاريخ التعيين",
        )
    return salon_day_bounds_utc(effective_date)[0]


@router.post("/{employee_id}/archive", response_model=EmployeeRead)
def archive_employee(
    employee_id: int,
    payload: EmployeeArchiveRequest = EmployeeArchiveRequest(),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    """Move an employee to the archive: they left the salon.

    Deliberately does **not** touch `show_in_pos` / `show_in_booking`. The old
    flow switched both off "so a return starts clean", but every operational
    surface already filters on `status == 'active'` and `is_active`, so the wipe
    hid nothing extra -- and restore never switched them back, so an employee
    who came back was invisible at the till and on the booking site until
    someone found the two switches again. The switches stay what the owner set
    them, because they describe a role, not an employment period.

    The row is never deleted: payroll, invoices and attendance history all
    point at it, and the archive is the record of who worked here.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    _ensure_employee_mutable(db, employee, current_user)

    if employee.status == "resigned":
        raise HTTPException(status_code=400, detail="الموظف مؤرشف بالفعل")

    archived_at = _archive_instant(payload.effective_date, employee.hire_date)
    reason = (payload.reason or "").strip()[:500] or None

    employee.status = "resigned"
    employee.is_active = False
    employee.archived_at = archived_at
    employee.archive_reason = reason
    employee.archived_by_user_id = current_user.id
    login_closed = _set_staff_login_enabled(db, employee, enabled=False)

    db.commit()
    db.refresh(employee)
    audit_log(
        db, request, current_user,
        action="archive_employee",
        entity_type="employee",
        entity_id=employee_id,
        description={
            "archived_on": archived_at.isoformat(),
            "reason": reason,
            "login_closed": login_closed,
            "visibility_preserved": {
                "show_in_pos": bool(employee.show_in_pos),
                "show_in_booking": bool(employee.show_in_booking),
            },
        },
    )
    return employee


@router.post("/{employee_id}/restore", response_model=EmployeeRead)
def restore_employee(
    employee_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    """Bring an archived employee back to the team.

    Only the employment decision is reversed. The visibility switches are left
    exactly as the owner set them before the person left -- which is the whole
    point of not wiping them on the way out -- and the login reopens with the
    account it belonged to.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    _ensure_employee_mutable(db, employee, current_user)

    if employee.status != "resigned":
        raise HTTPException(status_code=400, detail="الموظف ليس في الأرشيف")

    restored_from = {
        "archived_on": employee.archived_at.isoformat() if employee.archived_at else None,
        "reason": employee.archive_reason,
    }

    employee.status = "active"
    employee.is_active = True
    employee.archived_at = None
    employee.archive_reason = None
    employee.archived_by_user_id = None
    login_opened = _set_staff_login_enabled(db, employee, enabled=True)

    db.commit()
    db.refresh(employee)
    audit_log(
        db, request, current_user,
        action="restore_employee",
        entity_type="employee",
        entity_id=employee_id,
        description={
            "restored_from": restored_from,
            "login_reopened": login_opened,
            "visibility": {
                "show_in_pos": bool(employee.show_in_pos),
                "show_in_booking": bool(employee.show_in_booking),
            },
        },
    )
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
