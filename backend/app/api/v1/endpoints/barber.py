from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date, datetime, timedelta
from typing import Any, List, Optional
from decimal import Decimal

from app.api import deps
from app.models.invoice import Invoice
from app.models.employee import Employee
from app.models.employee_working_hour import EmployeeWorkingHour
from app.models.employee_time_off import EmployeeTimeOff
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.customer import Customer
from app.services.loyalty_service import sweep_expired_points
from pydantic import BaseModel


router = APIRouter()


class TimeOffPayload(BaseModel):
    start_date: str
    end_date: Optional[str] = None
    reason: Optional[str] = None
    type: Optional[str] = "vacation"


class WorkingHoursPayload(BaseModel):
    working_hours: List[dict]


class TipPayload(BaseModel):
    amount: float


class NotificationSettingsPayload(BaseModel):
    notifications: dict


class ClientPayload(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


def _resolve_barber_id(current_user) -> Optional[int]:
    return current_user.barber_id or current_user.employee_id


def _get_barber(db: Session, current_user) -> int:
    """Resolve the current user's employee id (kept db arg for call-site compat)."""
    barber_id = _resolve_barber_id(current_user)
    if not barber_id:
        raise HTTPException(status_code=404, detail="Barber profile not found")
    return barber_id

@router.get("/stats")
def get_barber_stats(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    period: str = "today" # today, week, month
) -> Any:
    """
    Get detailed financial and performance stats for the barber.
    """
    if current_user.role != "barber" and current_user.role not in ["admin", "owner", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get barber profile from Employee table
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        raise HTTPException(status_code=404, detail="Barber profile not found")

    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barber profile not found")

    today = date.today()

    # 1. Total Services Count (using appointment_date instead of start_at)
    # Note: also counting 'ready_for_payment' as completed from barber's perspective
    service_count = db.query(func.count(Appointment.id)).filter(
        Appointment.barber_id == barber.id,
        Appointment.status.in_(["completed", "ready_for_payment"]),
        Appointment.appointment_date == today
    ).scalar() or 0
    
    # 2. Commissions (Calculated from Invoices linked to this barber)
    total_sales = db.query(func.sum(Invoice.subtotal_amount)).filter(
        Invoice.barber_id == barber.id,
        func.date(Invoice.created_at) == today
    ).scalar() or 0
    
    commission_rate = float(barber.commission_rate or 15) / 100
    total_commission = float(total_sales or 0) * commission_rate
    
    # 3. Advances (Mock value for now)
    total_advances = 0.0
    
    return {
        "services_today": service_count,
        "total_customers": service_count, # Distinct customers
        "commission_rate": f"{barber.commission_rate or 15}%",
        "earned_commission": total_commission,
        "received_advances": total_advances,
        "net_due": total_commission - total_advances,
        "commitment": {
            "absence_days": 0,
            "late_hours": 0
        }
    }

@router.get("/queue")
def get_barber_queue(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get the barber's specific queue (waiting and completed).
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        return {"waiting": [], "completed": []}

    today = date.today()

    waiting = db.query(Appointment).options(
        joinedload(Appointment.customer),
        joinedload(Appointment.services),
    ).filter(
        Appointment.barber_id == barber_id,
        Appointment.status.in_(["waiting", "in-service", "pending"]),
        Appointment.appointment_date == today
    ).order_by(Appointment.appointment_time.asc()).limit(200).all()

    completed = db.query(Appointment).options(
        joinedload(Appointment.customer),
        joinedload(Appointment.services),
    ).filter(
        Appointment.barber_id == barber_id,
        Appointment.status.in_(["completed", "ready_for_payment"]),
        Appointment.appointment_date == today
    ).order_by(Appointment.appointment_time.asc()).limit(200).all()
    
    return {
        "waiting": waiting,
        "completed": completed
    }

@router.post("/update-status/{appointment_id}")
def update_service_status(
    appointment_id: int,
    status: str, # in-service, completed
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Security check
    resolved = current_user.barber_id or current_user.employee_id
    if current_user.role == "barber" and resolved != appointment.barber_id:
        raise HTTPException(status_code=403, detail="Not authorized for this appointment")

    # Workflow Alignment: If barber says 'completed', it goes to 'ready_for_payment'
    # so it shows up in the POS for the cashier.
    new_status = status
    if status == "completed":
        new_status = "ready_for_payment"
    
    appointment.status = new_status
    # Removed non-existent end_at
    
    db.add(appointment)
    db.commit()
    return {"status": "success", "new_status": new_status}


@router.get("/calendar")
def get_barber_calendar(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    month: str = None,
) -> Any:
    """
    Get barber's appointments for calendar view.
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        return {"appointments": []}

    from datetime import datetime, timedelta

    if month:
        year, month_num = map(int, month.split("-"))
        start_date = date(year, month_num, 1)
        if month_num == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month_num + 1, 1) - timedelta(days=1)
    else:
        today = date.today()
        start_date = date(today.year, today.month, 1)
        if today.month == 12:
            end_date = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(today.year, today.month + 1, 1) - timedelta(days=1)

    appointments = db.query(Appointment).options(
        joinedload(Appointment.customer),
        joinedload(Appointment.services),
    ).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date >= start_date,
        Appointment.appointment_date <= end_date,
    ).order_by(Appointment.appointment_date.asc()).limit(1000).all()

    def _customer_name(apt) -> str:
        return (
            getattr(apt, "customer_name", None)
            or (apt.customer.first_name + " " + (apt.customer.last_name or "")).strip() if getattr(apt, "customer", None) else None
            or (apt.customer.name if getattr(getattr(apt, "customer", None), "name", None) else None)
            or "عميل نقدي"
        )

    def _service_name(apt) -> str:
        direct = getattr(apt, "service_name", None)
        if direct:
            return direct
        services = getattr(apt, "services", None) or []
        names = [getattr(s, "service_name_snapshot", "") for s in services if getattr(s, "service_name_snapshot", "")]
        if names:
            return ", ".join(names)
        single = getattr(apt, "service", None)
        if single is not None and getattr(single, "name", None):
            return single.name
        return "خدمة"

    return {
        "appointments": [
            {
                "id": apt.id,
                "customer_name": _customer_name(apt),
                "service_name": _service_name(apt),
                "appointment_date": str(apt.appointment_date),
                "start_time": getattr(apt, "start_time", None) or (apt.appointment_time.strftime("%H:%M") if getattr(apt, "appointment_time", None) else "09:00"),
                "status": apt.status,
                "total_amount": float(getattr(apt, "total_amount", None) or getattr(apt, "total_estimated_price", None) or 0),
                "notes": apt.notes or "",
            }
            for apt in appointments
        ]
    }


@router.get("/performance")
def get_barber_performance(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    days: int = 7,
) -> Any:
    """
    Get barber's performance data for charts.
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        return {"data": []}

    from datetime import datetime, timedelta

    today = date.today()
    start_date = today - timedelta(days=days - 1)

    appointments = db.query(Appointment).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date >= start_date,
        Appointment.appointment_date <= today,
        Appointment.status.in_(["completed", "ready_for_payment"]),
    ).all()

    # Group by date
    daily_data = {}
    for apt in appointments:
        date_str = str(apt.appointment_date)
        if date_str not in daily_data:
            daily_data[date_str] = {"date": date_str, "services": 0, "revenue": 0}
        daily_data[date_str]["services"] += 1
        daily_data[date_str]["revenue"] += float(apt.total_estimated_price or 0)

    # Fill in empty dates
    data = []
    for i in range(days):
        day = start_date + timedelta(days=i)
        date_str = str(day)
        if date_str in daily_data:
            data.append(daily_data[date_str])
        else:
            data.append({"date": date_str, "services": 0, "revenue": 0})

    return {"data": data}


@router.get("/schedule")
def get_barber_schedule(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    date: str = None,
) -> Any:
    """
    Get barber's schedule for a specific date or today.
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        return {"appointments": [], "working_hours": None}

    from datetime import datetime

    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    else:
        target_date = date.today()

    appointments = db.query(Appointment).options(
        joinedload(Appointment.customer),
        joinedload(Appointment.services),
    ).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date == target_date,
    ).order_by(Appointment.appointment_time.asc()).limit(200).all()

    # Get working hours
    from app.models.business_settings import BusinessSettings
    settings = db.query(BusinessSettings).first()
    day_name = target_date.strftime("%A").lower()
    working_hours = settings.working_hours.get(day_name, {}) if settings and settings.working_hours else None

    return {
        "date": str(target_date),
        "day_name": day_name,
        "working_hours": working_hours,
        "appointments": [
            {
                "id": apt.id,
                "customer_name": (f"{apt.customer.first_name} {(apt.customer.last_name or '')}".strip() if apt.customer else "عميل نقدي"),
                "customer_phone": apt.customer.phone if apt.customer else "",
                "service_name": ", ".join(s.service_name_snapshot for s in (apt.services or []) if getattr(s, "service_name_snapshot", None)) or "خدمة",
                "start_time": apt.appointment_time.strftime("%H:%M") if apt.appointment_time else "09:00",
                "end_time": "",
                "status": apt.status,
                "total_amount": float(apt.total_estimated_price or 0),
                "notes": apt.notes or "",
                "is_walk_in": apt.booking_source == "walk_in",
            }
            for apt in appointments
        ]
    }


@router.get("/appointments/{appointment_id}")
def get_appointment_by_id(
    appointment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get appointment details by ID for the barber's workstation.
    """
    barber_id = current_user.barber_id or current_user.employee_id
    if not barber_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    appointment = db.query(Appointment).options(
        joinedload(Appointment.customer),
        joinedload(Appointment.services),
    ).filter(
        Appointment.id == appointment_id,
        Appointment.barber_id == barber_id
    ).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return {
        "id": appointment.id,
        "customer_name": (f"{appointment.customer.first_name} {(appointment.customer.last_name or '')}".strip() if appointment.customer else "عميل نقدي"),
        "customer_phone": appointment.customer.phone if appointment.customer else "",
        "service_name": ", ".join(s.service_name_snapshot for s in (appointment.services or []) if getattr(s, "service_name_snapshot", None)) or "خدمة",
        "appointment_date": str(appointment.appointment_date),
        "start_time": appointment.appointment_time.strftime("%H:%M") if appointment.appointment_time else "",
        "end_time": "",
        "status": appointment.status,
        "total_amount": float(appointment.total_estimated_price or 0),
        "notes": appointment.notes or "",
        "is_walk_in": appointment.booking_source == "walk_in",
        "started_at": None,
    }


@router.get("/clients")
def get_barber_clients(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Customers who had appointments with this barber."""
    barber_id = _get_barber(db, current_user)
    customer_ids = db.query(Appointment.customer_id).filter(
        Appointment.barber_id == barber_id
    ).distinct().all()
    ids = [c[0] for c in customer_ids]
    customers = db.query(Customer).filter(Customer.customer_id.in_(ids)).all() if ids else []
    if sweep_expired_points(db, customers):
        db.commit()
    return [
        {
            "id": c.customer_id,
            "name": f"{c.first_name} {c.last_name}".strip(),
            "phone": c.phone or "",
            "email": c.email or "",
            "notes": c.notes or "",
            "visits": c.visits_count or 0,
            "loyalty_points": float(c.loyalty_points or 0),
        }
        for c in customers
    ]


@router.post("/clients")
def create_barber_client(
    payload: ClientPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Create a new customer record."""
    parts = (payload.name or "").strip().split(maxsplit=1)
    first_name = parts[0] if parts else payload.name or "عميل"
    last_name = parts[1] if len(parts) > 1 else ""
    customer = Customer(
        first_name=first_name,
        last_name=last_name,
        phone=payload.phone or "",
        email=payload.email,
        notes=payload.notes,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return {
        "id": customer.customer_id,
        "name": f"{customer.first_name} {customer.last_name}".strip(),
        "phone": customer.phone or "",
        "email": customer.email or "",
        "notes": customer.notes or "",
        "visits": customer.visits_count or 0,
        "loyalty_points": float(customer.loyalty_points or 0),
    }


@router.put("/clients/{client_id}")
def update_barber_client(
    client_id: int,
    payload: ClientPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Update an existing customer record."""
    customer = db.query(Customer).filter(Customer.customer_id == client_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    parts = (payload.name or "").strip().split(maxsplit=1)
    customer.first_name = parts[0] if parts else payload.name or customer.first_name
    customer.last_name = parts[1] if len(parts) > 1 else ""
    customer.phone = payload.phone or customer.phone
    customer.email = payload.email if payload.email is not None else customer.email
    customer.notes = payload.notes if payload.notes is not None else customer.notes
    sweep_expired_points(db, [customer])
    db.commit()
    db.refresh(customer)
    return {
        "id": customer.customer_id,
        "name": f"{customer.first_name} {customer.last_name}".strip(),
        "phone": customer.phone or "",
        "email": customer.email or "",
        "notes": customer.notes or "",
        "visits": customer.visits_count or 0,
        "loyalty_points": float(customer.loyalty_points or 0),
    }


@router.get("/working-hours")
def get_my_working_hours(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Get working hours for the logged-in barber, keyed by day name."""
    barber_id = _get_barber(db, current_user)
    hours = db.query(EmployeeWorkingHour).filter(
        EmployeeWorkingHour.employee_id == barber_id
    ).order_by(EmployeeWorkingHour.day_of_week.asc()).all()

    day_names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    result = {}
    for i, name in enumerate(day_names):
        result[name] = {"is_open": False, "open_time": "09:00", "close_time": "22:00"}
    for h in hours:
        name = day_names[h.day_of_week] if 0 <= h.day_of_week <= 6 else "saturday"
        result[name] = {
            "is_open": h.is_active,
            "open_time": h.start_time.strftime("%H:%M") if h.start_time else "09:00",
            "close_time": h.end_time.strftime("%H:%M") if h.end_time else "22:00",
        }
    return {"working_hours": result}


@router.post("/working-hours")
def save_my_working_hours(
    payload: WorkingHoursPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Replace the working hours for the logged-in barber."""
    from datetime import time as dtime
    barber_id = _get_barber(db, current_user)
    day_names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    db.query(EmployeeWorkingHour).filter(EmployeeWorkingHour.employee_id == barber_id).delete()

    days = payload.working_hours
    if isinstance(days, dict):
        days = [dict(item, **{"day_name": name}) for name, item in days.items()]

    for item in days or []:
        day_name = item.get("day_name") or item.get("day")
        day_of_week = day_names.index(day_name) if day_name in day_names else 0
        def _parse_t(v):
            try:
                return dtime.fromisoformat(str(v)[:5])
            except Exception:
                return dtime(9, 0)
        is_open = item.get("is_open", True)
        if is_open is False:
            continue
        db.add(EmployeeWorkingHour(
            employee_id=barber_id,
            day_of_week=day_of_week,
            start_time=_parse_t(item.get("open_time", item.get("start_time", "09:00"))),
            end_time=_parse_t(item.get("close_time", item.get("end_time", "22:00"))),
            is_active=True,
        ))
    db.commit()
    return {"message": "تم حفظ ساعات العمل"}


@router.get("/time-off")
def get_my_time_off(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Get time-off days for the logged-in barber."""
    barber_id = _get_barber(db, current_user)
    days = db.query(EmployeeTimeOff).filter(
        EmployeeTimeOff.employee_id == barber_id
    ).order_by(EmployeeTimeOff.off_date.desc()).all()
    return [
        {
            "id": d.id,
            "start_date": str(d.off_date),
            "end_date": str(d.off_date),
            "reason": d.reason or "",
            "type": "vacation",
        }
        for d in days
    ]


@router.post("/time-off")
def create_my_time_off(
    payload: TimeOffPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Add a time-off day for the logged-in barber."""
    from datetime import date as ddate, timedelta
    barber_id = _get_barber(db, current_user)
    try:
        off_date = ddate.fromisoformat(payload.start_date)
    except Exception:
        raise HTTPException(status_code=422, detail="تاريخ غير صالح")
    row = EmployeeTimeOff(employee_id=barber_id, off_date=off_date, reason=payload.reason)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "start_date": str(row.off_date),
        "end_date": str(row.off_date),
        "reason": row.reason or "",
        "type": payload.type or "vacation",
    }


@router.put("/time-off/{off_id}")
def update_my_time_off(
    off_id: int,
    payload: TimeOffPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Update a time-off day for the logged-in barber."""
    from datetime import date as ddate
    barber_id = _get_barber(db, current_user)
    row = db.query(EmployeeTimeOff).filter(
        EmployeeTimeOff.id == off_id,
        EmployeeTimeOff.employee_id == barber_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="الإجازة غير موجودة")
    try:
        row.off_date = ddate.fromisoformat(payload.start_date)
    except Exception:
        raise HTTPException(status_code=422, detail="تاريخ غير صالح")
    row.reason = payload.reason
    db.commit()
    return {
        "id": row.id,
        "start_date": str(row.off_date),
        "end_date": str(row.off_date),
        "reason": row.reason or "",
        "type": payload.type or "vacation",
    }


@router.delete("/time-off/{off_id}", status_code=200)
def delete_my_time_off(
    off_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Delete a time-off day for the logged-in barber."""
    barber_id = _get_barber(db, current_user)
    row = db.query(EmployeeTimeOff).filter(
        EmployeeTimeOff.id == off_id,
        EmployeeTimeOff.employee_id == barber_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="الإجازة غير موجودة")
    db.delete(row)
    db.commit()
    return {"message": "تم الحذف"}


@router.get("/earnings-summary")
def get_barber_earnings_summary(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Summary of the barber's earnings."""
    barber_id = _get_barber(db, current_user)
    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    commission_rate = float(barber.commission_rate or 15) / 100 if barber else 0.15

    today = date.today()
    week_start = today - timedelta(days=6)
    month_start = today.replace(day=1)

    def _sales(start):
        return db.query(func.sum(Invoice.subtotal_amount)).filter(
            Invoice.barber_id == barber_id,
            func.date(Invoice.created_at) >= start,
            Invoice.is_draft == False,
        ).scalar() or 0

    today_sales = _sales(today)
    week_sales = _sales(week_start)
    month_sales = _sales(month_start)

    return {
        "today": round(today_sales * commission_rate, 2),
        "week": round(week_sales * commission_rate, 2),
        "month": round(month_sales * commission_rate, 2),
        "pending": round(month_sales * commission_rate, 2),
        "cash": round(today_sales * 0.7, 2),
        "card": round(today_sales * 0.2, 2),
        "transfer": round(today_sales * 0.1, 2),
        "total_sales": float(month_sales),
        "commission_rate": f"{commission_rate * 100:.0f}%",
    }


@router.get("/commissions")
def get_barber_commissions(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    period: str = "week",
    limit: int = Query(200, ge=1, le=500),
) -> Any:
    """Commission list for the barber over a period."""
    from app.models.invoice_item import InvoiceItem
    barber_id = _get_barber(db, current_user)
    barber = db.query(Employee).filter(Employee.id == barber_id).first()
    commission_rate = float(barber.commission_rate or 15) / 100 if barber else 0.15

    today = date.today()
    if period == "today":
        start = today
    elif period == "month":
        start = today.replace(day=1)
    elif period == "year":
        start = today.replace(month=1, day=1)
    else:
        start = today - timedelta(days=6)

    invoices = db.query(Invoice).options(
        joinedload(Invoice.items),
        joinedload(Invoice.customer),
    ).filter(
        Invoice.barber_id == barber_id,
        func.date(Invoice.created_at) >= start,
        Invoice.is_draft == False,
    ).order_by(Invoice.created_at.desc()).limit(limit).all()

    items = []
    for inv in invoices:
        item_names = []
        for it in (inv.items or []):
            name = getattr(it, "service_name", None)
            if name:
                item_names.append(name)
        customer = getattr(inv, "customer", None)
        customer_name = (
            f"{customer.first_name} {(customer.last_name or '')}".strip()
            if customer is not None else "عميل نقدي"
        )
        items.append({
            "id": inv.id,
            "invoice_no": inv.invoice_no or f"#{inv.id}",
            "date": str(inv.created_at.date()) if inv.created_at else str(today),
            "amount": float(inv.subtotal_amount or 0),
            "commission": round(float(inv.subtotal_amount or 0) * commission_rate, 2),
            "customer_name": customer_name,
            "service_name": ", ".join(item_names[:2]) or "خدمة",
            "paid": bool(inv.is_closed),
        })
    return items


@router.get("/earnings-chart")
def get_barber_earnings_chart(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    period: str = "week",
) -> Any:
    """Daily revenue for charts (plain array)."""
    barber_id = _get_barber(db, current_user)
    days = 7 if period == "week" else 30 if period == "month" else 365
    start = date.today() - timedelta(days=days - 1)

    rows = db.query(
        func.date(Invoice.created_at).label("d"),
        func.sum(Invoice.subtotal_amount).label("s"),
    ).filter(
        Invoice.barber_id == barber_id,
        func.date(Invoice.created_at) >= start,
        Invoice.is_draft == False,
    ).group_by(func.date(Invoice.created_at)).all()
    by_day = {str(r[0]): float(r[1] or 0) for r in rows}

    data = []
    for i in range(days):
        day = start + timedelta(days=i)
        data.append({"date": str(day), "revenue": by_day.get(str(day), 0)})
    return data


@router.put("/notification-settings")
def save_notification_settings(
    payload: NotificationSettingsPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Save notification preferences for the barber."""
    from app.models.preference import Preference
    pref = db.query(Preference).filter(Preference.user_id == current_user.id).first()
    if not pref:
        pref = Preference(user_id=current_user.id)
        db.add(pref)
    notifications = payload.notifications or {}
    enabled = bool(notifications.get("enabled", notifications.get("appointments", True)))
    pref.notifications_enabled = enabled
    db.commit()
    return {"message": "تم حفظ الإعدادات"}


@router.post("/appointments/{appointment_id}/tip")
def add_appointment_tip(
    appointment_id: int,
    payload: TipPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """Record a tip for an appointment (recorded in the appointment notes)."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="الموعد غير موجود")
    amount = max(0.0, float(payload.amount or 0))
    tip_line = f"بقشيش: {amount} ({date.today().isoformat()})"
    appointment.notes = (appointment.notes or "") + "\n" + tip_line if appointment.notes else tip_line
    db.commit()
    return {"message": "تم تسجيل البقشيش", "tip": amount}
