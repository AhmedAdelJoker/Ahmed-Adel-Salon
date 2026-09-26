from datetime import date, datetime, time, timedelta
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.appointment import Appointment
from app.models.business_settings import BusinessSettings
from app.models.employee import Employee
from app.core.working_hours import resolve_window

def get_available_time_slots(
    db: Session, 
    barber_id: int, 
    target_date: date,
    slot_duration: int = 30
) -> List[Dict]:
    """
    Calculates available time slots for a barber on a specific date.
    """
    # 1. Get Shop Working Hours
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return []

    window = resolve_window(settings.working_hours, target_date)
    if window is None:
        return []

    _day_config, shop_open_dt, shop_close_dt = window

    # 2. Get existing appointments for this barber on this date
    existing_appts = db.query(Appointment).filter(
        Appointment.barber_id == barber_id,
        Appointment.appointment_date == target_date,
        Appointment.status.in_(["pending", "confirmed", "waiting", "in_progress", "ready_for_payment"])
    ).all()
    
    # Map occupied intervals
    occupied_intervals = []
    for appt in existing_appts:
        start = datetime.combine(target_date, appt.appointment_time)
        duration = appt.total_estimated_duration_minutes or 30
        end = start + timedelta(minutes=duration)
        occupied_intervals.append((start, end))
    
    # 3. Generate slots
    slots = []
    current_slot_start = shop_open_dt
    
    while current_slot_start + timedelta(minutes=slot_duration) <= shop_close_dt:
        slot_end = current_slot_start + timedelta(minutes=slot_duration)
        
        # Check if this slot overlaps with any occupied interval
        is_occupied = False
        for occ_start, occ_end in occupied_intervals:
            if current_slot_start < occ_end and slot_end > occ_start:
                is_occupied = True
                break
        
        if not is_occupied:
            slots.append({
                "time": current_slot_start.strftime("%H:%M"),
                "available": True
            })
        else:
            slots.append({
                "time": current_slot_start.strftime("%H:%M"),
                "available": False
            })
            
        current_slot_start += timedelta(minutes=slot_duration)
        
    return slots
