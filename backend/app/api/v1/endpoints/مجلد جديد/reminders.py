from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.services.reminder_service import send_due_reminders

router = APIRouter(prefix="/reminders", tags=["Reminder Jobs"])

@router.post("/run")
def run_reminders(db: Session = Depends(get_db), current_user: User = Depends(require_owner_or_manager)):
    send_due_reminders(db)
    return {"message": "تم تشغيل فحص وإرسال التذكيرات"}



