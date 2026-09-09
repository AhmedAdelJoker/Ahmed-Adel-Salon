from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from app.models.pos_shift import PosShift
from app.models.invoice import Invoice
from app.models.business_settings import BusinessSettings
from app.models.user import User
from app.services.activity_log_service import log_activity
from app.services.notification_service import create_notification

def is_within_working_hours(db: Session) -> bool:
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return True # Default to open if no settings
    
    now = datetime.now()
    day_name = now.strftime("%A").lower()
    day_config = settings.working_hours.get(day_name)
    
    # Check if the day is marked as open
    if not day_config or not day_config.get("is_open"):
        return False
        
    start_str = day_config.get("open_time")
    end_str = day_config.get("close_time")
    
    if not start_str or not end_str:
        return True
        
    try:
        start_time = datetime.strptime(start_str, "%H:%M").time()
        end_time = datetime.strptime(end_str, "%H:%M").time()
        current_time = now.time()
        
        if start_time <= end_time:
            return start_time <= current_time <= end_time
        else: # Crosses midnight
            return current_time >= start_time or current_time <= end_time
    except Exception:
        return True

def auto_close_expired_shifts(db: Session):
    """
    Closes all open POS shifts if the current time is past the business closing time 
    plus a grace period defined in BusinessSettings.
    """
    settings = db.query(BusinessSettings).first()
    if not settings or not settings.working_hours:
        return 0
    
    # Use grace period from settings, default to 30 if not set
    grace_period_minutes = getattr(settings, "shift_auto_close_grace_period", 30) or 30
    
    now = datetime.now()
    day_name = now.strftime("%A").lower()
    day_config = settings.working_hours.get(day_name)
    
    should_close_all = False
    if not day_config or not day_config.get("is_open"):
        should_close_all = True
    else:
        close_str = day_config.get("close_time")
        open_str = day_config.get("open_time")
        if close_str and open_str:
            try:
                close_time = datetime.strptime(close_str, "%H:%M").time()
                open_time = datetime.strptime(open_str, "%H:%M").time()
                current_time = now.time()
                
                if open_time <= close_time:
                    closing_datetime = datetime.combine(now.date(), close_time)
                    if current_time > close_time:
                        if now > (closing_datetime + timedelta(minutes=grace_period_minutes)):
                            should_close_all = True
                else: # Overnight logic
                    if not (current_time >= open_time or current_time <= close_time):
                        closing_datetime = datetime.combine(now.date(), close_time)
                        if current_time > close_time:
                            if now > (closing_datetime + timedelta(minutes=grace_period_minutes)):
                                should_close_all = True
                        elif current_time < open_time:
                            yesterday_closing = datetime.combine(now.date() - timedelta(days=1), close_time)
                            if now > (yesterday_closing + timedelta(minutes=grace_period_minutes)):
                                should_close_all = True
            except Exception as e:
                print(f"Error calculating shift expiration: {e}")
                pass

    if should_close_all:
        open_shifts = db.query(PosShift).filter(PosShift.status == "open").all()
        closed_count = 0
        for shift in open_shifts:
            invoices = db.query(Invoice).filter(
                Invoice.created_at >= shift.opened_at,
                Invoice.created_by_user_id == shift.user_id
            ).all()
            cash_sales = sum(inv.total_amount for inv in invoices if (inv.payment_method or "").upper() == "CASH")
            
            shift.status = "closed"
            shift.closed_at = now
            shift.total_sales = sum(inv.total_amount for inv in invoices)
            shift.invoice_count = len(invoices)
            shift.expected_closing_cash = shift.opening_cash + cash_sales
            shift.actual_closing_cash = shift.expected_closing_cash
            shift.closing_note = "إغلاق تلقائي بواسطة النظام لنهاية ساعات العمل"
            
            log_activity(
                db, 
                user_id=None,
                action="AUTO_CLOSE_SHIFT", 
                entity_type="PosShift", 
                entity_id=str(shift.id), 
                description=f"تم إغلاق وردية الموظف {shift.user.full_name if shift.user else 'غير معروف'} تلقائياً"
            )
            
            managers = db.query(User).filter(User.role.in_(["manager", "owner"])).all()
            for mgr in managers:
                create_notification(
                    db, 
                    user_id=mgr.id, 
                    title="إغلاق تلقائي للوردية", 
                    message=f"تم إغلاق وردية الموظف {shift.user.full_name if shift.user else 'غير معروف'} تلقائياً لنهاية الدوام. إجمالي مبيعات الوردية: {shift.total_sales} {settings.currency}", 
                    type="info"
                )
            
            closed_count += 1
        
        db.commit()
        return closed_count
    
    return 0
