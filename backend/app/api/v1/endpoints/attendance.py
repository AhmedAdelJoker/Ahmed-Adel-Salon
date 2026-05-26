from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io
from datetime import datetime, date, time

from app.db.session import get_db
from app.api.deps import require_owner_or_manager, require_any_staff
from app.models.employee import Employee
from app.models.employee_presence_log import EmployeePresenceLog
from app.models.user import User
from app.schemas.barber_presence import BarberPresenceRead
from app.services.activity_service import log_activity

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.get("/", response_model=List[BarberPresenceRead])
def get_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
    employee_id: Optional[int] = None,
    limit: int = 100
):
    return get_attendance_logs(db, current_user, employee_id, limit)

@router.get("/logs", response_model=List[BarberPresenceRead])
def get_attendance_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
    employee_id: Optional[int] = None,
    limit: int = 100
):
    query = db.query(EmployeePresenceLog)
    if employee_id:
        query = query.filter(EmployeePresenceLog.employee_id == employee_id)
    
    logs = query.order_by(EmployeePresenceLog.created_at.desc()).limit(limit).all()
    
    result = []
    for log in logs:
        result.append({
            "employee_id": log.employee_id,
            "employee_name": log.employee.full_name if log.employee else "Unknown",
            "status": log.status,
            "created_at": log.created_at
        })
    return result



@router.get("/employee-summary")
def get_employee_attendance_summary(
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    query = db.query(EmployeePresenceLog).filter(EmployeePresenceLog.employee_id == employee_id)

    if start_date:
        query = query.filter(EmployeePresenceLog.created_at >= datetime.combine(start_date, time.min))

    if end_date:
        query = query.filter(EmployeePresenceLog.created_at <= datetime.combine(end_date, time.max))

    logs = query.order_by(EmployeePresenceLog.created_at.desc()).all()
    check_ins = sum(1 for item in logs if item.status == "in")
    check_outs = sum(1 for item in logs if item.status == "out")
    last_log = logs[0] if logs else None

    return {
        "employee_id": employee.id,
        "employee_name": employee.full_name,
        "total_logs": len(logs),
        "check_ins": check_ins,
        "check_outs": check_outs,
        "current_status": last_log.status if last_log else None,
        "last_seen_at": last_log.created_at if last_log else None,
    }

@router.post("/register")
def register_attendance(
    employee_id: int,
    status_type: str, # "in", "out", "break", "break_end"
    timestamp: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    valid_statuses = ["in", "out", "break", "break_end"]
    if status_type not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"حالة غير صالحة. يجب أن تكون واحدة من {valid_statuses}")
    
    new_log = EmployeePresenceLog(
        employee_id=employee_id,
        status=status_type,
        created_at=timestamp or datetime.now()
    )
    db.add(new_log)
    db.commit()
    
    log_activity(
        db,
        user_id=current_user.id,
        action="register",
        entity_type="attendance",
        description=f"تسجيل {status_type} للموظف {employee.full_name}"
    )
    
    return {"message": "تم تسجيل العملية بنجاح"}

@router.post("/fingerprint")
def fingerprint_attendance(
    employee_id: int,
    type: str, # "in" or "out"
    db: Session = Depends(get_db)
):
    """
    Endpoint for Fingerprint Device Integration
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    new_log = EmployeePresenceLog(
        employee_id=employee_id,
        status=type,
        created_at=datetime.now()
    )
    db.add(new_log)
    db.commit()
    
    return {"status": "success", "employee": employee.full_name}

@router.post("/import-excel")
async def import_attendance_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="ملف غير مدعوم")

    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Standardize columns
        df.columns = [c.strip().lower() for c in df.columns]
        
        # Mapping common columns
        mapping = {
            'الاسم': 'name',
            'اسم الموظف': 'name',
            'الحالة': 'status',
            'الوقت': 'time',
            'التاريخ': 'date',
            'name': 'name',
            'employee_name': 'name',
            'status': 'status',
            'time': 'time',
            'date': 'date'
        }
        df.rename(columns=mapping, inplace=True)

        count = 0
        errors = []
        
        # Get all employees for mapping
        employees = db.query(Employee).all()
        emp_map = {emp.full_name.strip().lower(): emp.id for emp in employees}
        
        for index, row in df.iterrows():
            try:
                name = str(row.get('name', '')).strip().lower()
                status_val = str(row.get('status', 'in')).strip().lower()
                
                # Normalize status
                if 'حض' in status_val or 'in' in status_val:
                    status_val = "in"
                elif 'انص' in status_val or 'out' in status_val:
                    status_val = "out"
                else:
                    status_val = "in"
                
                emp_id = emp_map.get(name)
                if not emp_id:
                    errors.append(f"السطر {index+2}: الموظف '{name}' غير موجود")
                    continue
                
                # Handle time/date
                dt = datetime.now()
                if 'date' in row and pd.notna(row['date']):
                    if 'time' in row and pd.notna(row['time']):
                        # Combine date and time
                        dt_str = f"{row['date']} {row['time']}"
                        try:
                            dt = pd.to_datetime(dt_str)
                        except:
                            dt = pd.to_datetime(row['date'])
                    else:
                        dt = pd.to_datetime(row['date'])
                
                log = EmployeePresenceLog(
                    employee_id=emp_id,
                    status=status_val,
                    created_at=dt
                )
                db.add(log)
                count += 1
            except Exception as e:
                errors.append(f"خطأ في السطر {index+2}: {str(e)}")
        
        db.commit()
        
        log_activity(
            db,
            user_id=current_user.id,
            action="import",
            entity_type="attendance",
            description=f"استيراد {count} سجل حضور من ملف {file.filename}"
        )
        
        return {"message": f"تم استيراد {count} سجل بنجاح", "errors": errors}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"فشل معالجة الملف: {str(e)}")

@router.post("/import-biometric")
async def import_biometric_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # This is similar to Excel import but can be tuned for specific biometric device exports
    # For now, we'll treat it as a more flexible Excel/CSV import
    return await import_attendance_excel(file, db, current_user)



