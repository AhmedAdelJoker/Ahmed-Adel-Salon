from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import delete
from app.models.appointment import Appointment

def cleanup_old_cancelled_appointments(db: Session):
    """
    Deletes cancelled appointments that are older than 30 days.
    Returns the number of deleted records.
    """
    thirty_days_ago = datetime.now() - timedelta(days=30)
    
    stmt = delete(Appointment).where(
        Appointment.status == "cancelled",
        Appointment.updated_at <= thirty_days_ago
    )
    
    result = db.execute(stmt)
    db.commit()
    
    return result.rowcount
