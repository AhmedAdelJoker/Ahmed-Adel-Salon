from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.appointment import Appointment
from app.models.business_settings import BusinessSettings
from app.services.meta_whatsapp_service import (
    send_appointment_reminder_24h_template,
    send_appointment_reminder_2h_template,
    send_text_message,
    is_meta_whatsapp_configured
)

def run_automated_reminders(db: Session):
    """
    سكان للمواعيد القادمة وإرسال التذكيرات اللازمة.
    """
    if not is_meta_whatsapp_configured():
        return {"status": "skipped", "reason": "WhatsApp not configured"}

    settings = db.query(BusinessSettings).first()
    # Assume we have settings for automation later, for now we proceed if configured
    
    now = datetime.now()
    
    # 1. 24h Reminders
    # Target appointments between 23h and 25h from now
    target_24h_start = now + timedelta(hours=23)
    target_24h_end = now + timedelta(hours=25)
    
    appointments_24h = db.query(Appointment).filter(
        Appointment.status == "confirmed",
        Appointment.start_at >= target_24h_start,
        Appointment.start_at <= target_24h_end,
        Appointment.reminder_24h_sent == False
    ).all()
    
    sent_24h = 0
    for appt in appointments_24h:
        try:
            if appt.customer and appt.customer.phone:
                send_appointment_reminder_24h_template(
                    db,
                    to_phone=appt.customer.phone,
                    customer_name=appt.customer.first_name,
                    appointment_date=str(appt.appointment_date),
                    appointment_time=str(appt.appointment_time),
                    barber_name=appt.barber.display_name if appt.barber else "صالون المحترفين",
                    appointment_id=appt.id
                )
                appt.reminder_24h_sent = True
                sent_24h += 1
        except Exception as e:
            print(f"Error sending 24h reminder for appt {appt.id}: {e}")

    # 2. 2h Reminders
    # Target appointments between 1h and 3h from now
    target_2h_start = now + timedelta(hours=1)
    target_2h_end = now + timedelta(hours=3)
    
    appointments_2h = db.query(Appointment).filter(
        Appointment.status == "confirmed",
        Appointment.start_at >= target_2h_start,
        Appointment.start_at <= target_2h_end,
        Appointment.reminder_2h_sent == False
    ).all()
    
    sent_2h = 0
    for appt in appointments_2h:
        try:
            if appt.customer and appt.customer.phone:
                send_appointment_reminder_2h_template(
                    db,
                    to_phone=appt.customer.phone,
                    appointment_time=str(appt.appointment_time),
                    barber_name=appt.barber.display_name if appt.barber else "صالون المحترفين",
                    appointment_id=appt.id
                )
                appt.reminder_2h_sent = True
                sent_2h += 1
        except Exception as e:
            print(f"Error sending 2h reminder for appt {appt.id}: {e}")

    db.commit()
    return {"sent_24h": sent_24h, "sent_2h": sent_2h}

def send_post_visit_feedback(db: Session, appointment_id: int):
    """
    إرسال طلب تقييم بعد انتهاء الزيارة.
    """
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt or not appt.customer or not appt.customer.phone:
        return
    
    # Check if already sent feedback request for this appt
    from app.models.notification_log import NotificationLog
    existing = db.query(NotificationLog).filter(
        NotificationLog.appointment_id == appointment_id,
        NotificationLog.message_type == "feedback_request"
    ).first()
    
    if existing:
        return

    # In a real scenario, we might use a template. For now, a text message.
    # Using the slug from the appointment or a general review route
    feedback_url = f"https://barbershop.com/review?appt={appt.id}" 
    message = f"شكراً لزيارتك لصالون المحترفين يا {appt.customer.first_name}! نود معرفة رأيك في الخدمة لتطوير أنفسنا دائماً. يمكنك التقييم من هنا: {feedback_url}"
    
    try:
        send_text_message(
            db,
            to_phone=appt.customer.phone,
            body=message,
            message_type="feedback_request",
            appointment_id=appt.id
        )
    except Exception as e:
        print(f"Error sending feedback request for appt {appt.id}: {e}")



