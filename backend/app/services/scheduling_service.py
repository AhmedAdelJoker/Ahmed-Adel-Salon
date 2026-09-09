from datetime import date, datetime, time, timedelta
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.appointment import Appointment
from app.models.business_settings import BusinessSettings
from app.models.employee import Employee

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
    
    day_name = target_date.strftime("%A").lower()
    day_config = settings.working_hours.get(day_name)
    
    if not day_config or not day_config.get("is_open"):
        return []
        
    open_time_str = day_config.get("open_time")
    close_time_str = day_config.get("close_time")
    
    if not open_time_str or not close_time_str:
        return []
        
    open_time = datetime.strptime(open_time_str, "%H:%M").time()
    close_time = datetime.strptime(close_time_str, "%H:%M").time()
    
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
    current_slot_start = datetime.combine(target_date, open_time)
    shop_close_dt = datetime.combine(target_date, close_time)
    
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
