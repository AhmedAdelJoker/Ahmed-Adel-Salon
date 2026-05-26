from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.employee import Employee
from app.models.employee_time_off import EmployeeTimeOff
from app.models.employee_working_hour import EmployeeWorkingHour
from app.models.service import Service

ACTIVE_BOOKING_STATUSES = ("pending", "confirmed")


@dataclass
class EmployeeDaySchedule:
    employee: Employee
    start_at: datetime
    end_at: datetime
    busy_intervals: list[tuple[datetime, datetime]]
    day_load: int


def list_assignable_barbers(
    db: Session,
    *,
    online_only: bool = False,
    walk_in_only: bool = False,
) -> list[Employee]:
    query = db.query(Employee).filter(
        Employee.is_active == True,
        Employee.status == "active",
    )

    if online_only:
        query = query.filter(Employee.allow_online_booking == True)
    if walk_in_only:
        query = query.filter(Employee.allow_walk_in_assignment == True)

    employees = query.order_by(Employee.display_order.asc(), Employee.id.asc()).all()

    if walk_in_only and not employees:
        employees = (
            db.query(Employee)
            .filter(
                Employee.is_active == True,
                Employee.status == "active",
            )
            .order_by(Employee.display_order.asc(), Employee.id.asc())
            .all()
        )

    return employees


def calculate_total_duration_minutes(db: Session, items: list) -> int:
    total_duration = 0

    for item in items or []:
        service = (
            db.query(Service)
            .filter(Service.id == item.service_id, Service.is_active == True)
            .first()
        )
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"الخدمة {item.service_id} غير موجودة",
            )

        quantity = int(item.quantity or 1)
        duration = int(getattr(service, "duration_minutes", 30) or 30)
        total_duration += duration * quantity

    return total_duration or 30


def _build_busy_intervals(
    db: Session,
    *,
    employee_id: int,
    booking_date: date,
) -> tuple[list[tuple[datetime, datetime]], int]:
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.employee_id == employee_id,
            Appointment.appointment_date == booking_date,
            Appointment.status.in_(ACTIVE_BOOKING_STATUSES),
        )
        .order_by(Appointment.start_at.asc(), Appointment.id.asc())
        .all()
    )

    busy_intervals: list[tuple[datetime, datetime]] = []
    for appointment in appointments:
        if appointment.start_at and appointment.end_at:
            busy_intervals.append((appointment.start_at, appointment.end_at))
            continue

        start_at = datetime.combine(booking_date, appointment.appointment_time)
        end_at = start_at + timedelta(
            minutes=int(appointment.total_estimated_duration_minutes or 30)
        )
        busy_intervals.append((start_at, end_at))

    return busy_intervals, len(appointments)


def _build_employee_day_schedule(
    db: Session,
    *,
    employee: Employee,
    booking_date: date,
    strict_schedule: bool,
) -> EmployeeDaySchedule | None:
    off_day = (
        db.query(EmployeeTimeOff)
        .filter(
            EmployeeTimeOff.employee_id == employee.id,
            EmployeeTimeOff.off_date == booking_date,
        )
        .first()
    )
    if off_day:
        return None

    working_hour = (
        db.query(EmployeeWorkingHour)
        .filter(
            EmployeeWorkingHour.employee_id == employee.id,
            EmployeeWorkingHour.day_of_week == booking_date.weekday(),
            EmployeeWorkingHour.is_active == True,
        )
        .first()
    )

    start_time = None
    end_time = None

    if working_hour:
        start_time = working_hour.start_time
        end_time = working_hour.end_time
    else:
        from app.models.business_settings import BusinessSettings
        settings_row = db.query(BusinessSettings).first()
        salon_hours = settings_row.working_hours if settings_row else None
        
        fallback_hours = {
            "saturday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
            "sunday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
            "monday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
            "tuesday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
            "wednesday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
            "thursday": {"is_open": True, "open_time": "10:00", "close_time": "22:00"},
            "friday": {"is_open": False, "open_time": None, "close_time": None}
        }
        
        hours_dict = salon_hours if salon_hours else fallback_hours
        weekday_map = {
            0: "monday",
            1: "tuesday",
            2: "wednesday",
            3: "thursday",
            4: "friday",
            5: "saturday",
            6: "sunday"
        }
        day_name = weekday_map[booking_date.weekday()]
        day_config = hours_dict.get(day_name)
        
        if not day_config or not day_config.get("is_open"):
            if strict_schedule:
                return None
            else:
                start_time = time(0, 0)
                end_time = time(23, 59)
        else:
            open_str = day_config.get("open_time") or "10:00"
            close_str = day_config.get("close_time") or "22:00"
            try:
                start_time = datetime.strptime(open_str, "%H:%M").time()
                end_time = datetime.strptime(close_str, "%H:%M").time()
            except ValueError:
                start_time = time(10, 0)
                end_time = time(22, 0)

    busy_intervals, day_load = _build_busy_intervals(
        db,
        employee_id=employee.id,
        booking_date=booking_date,
    )

    return EmployeeDaySchedule(
        employee=employee,
        start_at=datetime.combine(booking_date, start_time),
        end_at=datetime.combine(booking_date, end_time),
        busy_intervals=busy_intervals,
        day_load=day_load,
    )


def _slot_fits(
    schedule: EmployeeDaySchedule,
    *,
    slot_start: datetime,
    duration_minutes: int,
) -> bool:
    slot_end = slot_start + timedelta(minutes=max(int(duration_minutes or 30), 1))
    if slot_start < schedule.start_at or slot_end > schedule.end_at:
        return False

    for busy_start, busy_end in schedule.busy_intervals:
        if slot_start < busy_end and slot_end > busy_start:
            return False

    return True


def get_available_barbers_for_slot(
    db: Session,
    *,
    booking_date: date,
    appointment_time: time,
    total_duration_minutes: int,
    barbers: Sequence[Employee],
    strict_schedule: bool,
) -> list[Employee]:
    slot_start = datetime.combine(booking_date, appointment_time)
    available_schedules: list[EmployeeDaySchedule] = []

    for employee in barbers:
        schedule = _build_employee_day_schedule(
            db,
            employee=employee,
            booking_date=booking_date,
            strict_schedule=strict_schedule,
        )
        if schedule and _slot_fits(
            schedule,
            slot_start=slot_start,
            duration_minutes=total_duration_minutes,
        ):
            available_schedules.append(schedule)

    available_schedules.sort(
        key=lambda schedule: (
            schedule.day_load,
            schedule.employee.display_order,
            schedule.employee.id,
        )
    )
    return [schedule.employee for schedule in available_schedules]


def auto_assign_barber(
    db: Session,
    *,
    booking_date: date,
    appointment_time: time,
    total_duration_minutes: int,
    barbers: Sequence[Employee],
    strict_schedule: bool,
    no_barber_detail: str,
) -> Employee:
    available_barbers = get_available_barbers_for_slot(
        db,
        booking_date=booking_date,
        appointment_time=appointment_time,
        total_duration_minutes=total_duration_minutes,
        barbers=barbers,
        strict_schedule=strict_schedule,
    )

    if not available_barbers:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=no_barber_detail,
        )

    return available_barbers[0]


def list_available_slots(
    db: Session,
    *,
    booking_date: date,
    total_duration_minutes: int,
    barbers: Sequence[Employee],
    strict_schedule: bool,
    slot_step_minutes: int = 30,
) -> list[str]:
    schedules = [
        schedule
        for employee in barbers
        if (
            schedule := _build_employee_day_schedule(
                db,
                employee=employee,
                booking_date=booking_date,
                strict_schedule=strict_schedule,
            )
        )
    ]

    if not schedules:
        return []

    current = min(schedule.start_at for schedule in schedules)
    last_end = max(schedule.end_at for schedule in schedules)
    available_slots: list[str] = []

    while current + timedelta(minutes=total_duration_minutes) <= last_end:
        if any(
            _slot_fits(
                schedule,
                slot_start=current,
                duration_minutes=total_duration_minutes,
            )
            for schedule in schedules
        ):
            available_slots.append(current.strftime("%H:%M"))

        current += timedelta(minutes=slot_step_minutes)

    return available_slots
