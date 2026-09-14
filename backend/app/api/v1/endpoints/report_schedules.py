from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_owner_or_manager
from app.db.session import get_db
from app.models.report_schedule import ReportSchedule
from app.models.user import User
from app.schemas.report_schedule import (
    VALID_CHANNELS,
    VALID_FREQUENCIES,
    ReportScheduleCreate,
    ReportScheduleRead,
    ReportScheduleUpdate,
)
from app.services.scheduled_reports import compute_next_run, run_due_schedules, run_schedule

router = APIRouter(prefix="/report-schedules", tags=["Report Schedules"])


def _validate(payload_frequency=None, payload_channel=None) -> None:
    if payload_frequency is not None and payload_frequency not in VALID_FREQUENCIES:
        raise HTTPException(status_code=422, detail=f"frequency must be one of {VALID_FREQUENCIES}")
    if payload_channel is not None and payload_channel not in VALID_CHANNELS:
        raise HTTPException(status_code=422, detail=f"channel must be one of {VALID_CHANNELS}")


@router.get("", response_model=list[ReportScheduleRead])
def list_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    return db.query(ReportSchedule).order_by(ReportSchedule.id.desc()).all()


@router.post("", response_model=ReportScheduleRead)
def create_schedule(
    payload: ReportScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    _validate(payload.frequency, payload.channel)
    now = datetime.utcnow()
    row = ReportSchedule(
        name=payload.name or "التقرير المالي الدوري",
        frequency=payload.frequency,
        channel=payload.channel,
        target_phone=payload.target_phone,
        is_active=payload.is_active,
        next_run_at=compute_next_run(payload.frequency, now),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{schedule_id}", response_model=ReportScheduleRead)
def update_schedule(
    schedule_id: int,
    payload: ReportScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    row = db.query(ReportSchedule).filter(ReportSchedule.id == schedule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Report schedule not found")
    _validate(payload.frequency, payload.channel)
    data = payload.model_dump(exclude_none=True)
    frequency_changed = "frequency" in data and data["frequency"] != row.frequency
    for field_name, value in data.items():
        if hasattr(row, field_name):
            setattr(row, field_name, value)
    if frequency_changed:
        row.next_run_at = compute_next_run(row.frequency, datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    row = db.query(ReportSchedule).filter(ReportSchedule.id == schedule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Report schedule not found")
    db.delete(row)
    db.commit()
    return None


@router.post("/{schedule_id}/run-now")
def run_schedule_now(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    row = db.query(ReportSchedule).filter(ReportSchedule.id == schedule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Report schedule not found")
    return run_schedule(db, row)


@router.post("/run-due")
def trigger_due_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """Manually trigger all due schedules (the APScheduler job calls this logic automatically)."""
    return {"results": run_due_schedules(db)}
