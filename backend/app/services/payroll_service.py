from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any

from app.models.employee import Employee
from app.models.employee_presence_log import EmployeePresenceLog
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.salary_advance import SalaryAdvance

def calculate_attendance_metrics(
    db: Session, 
    employee_id: int, 
    start_date: datetime, 
    end_date: datetime
) -> Dict[str, Any]:
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return {"error": "Employee not found"}
    
    # Default work days: Mon-Sat (0-5 and 6 is Sun, let's say Sun-Thu are 6,0,1,2,3)
    # Python datetime: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    # Most salons in MENA work all days except maybe one day.
    # If not specified, assume 6 days a week (excluding Friday=4)
    work_days = employee.work_days_json or [0, 1, 2, 3, 5, 6] 
    
    expected_days = 0
    actual_days = 0
    
    current_date = start_date.date()
    target_end_date = end_date.date()
    
    # We only care about days up to today if we are calculating "Expected Net"
    today = date.today()
    loop_end_date = min(target_end_date, today + timedelta(days=1))
    
    # For full month calculation, we iterate the whole range
    is_full_month = target_end_date > today
    if not is_full_month:
        loop_end_date = target_end_date

    # To avoid many queries, get all logs for this employee in this range
    logs = db.query(EmployeePresenceLog).filter(
        EmployeePresenceLog.employee_id == employee_id,
        EmployeePresenceLog.created_at >= start_date,
        EmployeePresenceLog.created_at < end_date
    ).all()
    
    log_dates = {log.created_at.date() for log in logs if log.status == "in"}
    
    temp_date = current_date
    while temp_date < target_end_date:
        if temp_date.weekday() in work_days:
            expected_days += 1
            if temp_date in log_dates:
                actual_days += 1
        temp_date += timedelta(days=1)
    
    attendance_percent = (actual_days / expected_days * 100) if expected_days > 0 else 100
    
    return {
        "expected_days": expected_days,
        "actual_days": actual_days,
        "missed_days": expected_days - actual_days,
        "attendance_percent": round(attendance_percent, 2)
    }

def calculate_expected_net_salary(
    db: Session,
    employee_id: int,
    month: int,
    year: int
) -> Dict[str, Any]:
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return {"error": "Employee not found"}
        
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
        
    # 1. Commission (All types can earn commission usually)
    commission_amount = Decimal("0.00")
    if emp.job_title == "barber":
        comm_sum = db.query(func.sum(InvoiceItem.commission_amount)).join(Invoice).filter(
            Invoice.barber_id == emp.id,
            Invoice.created_at >= start_date,
            Invoice.created_at < end_date
        ).scalar()
        commission_amount = Decimal(str(comm_sum or 0))
    elif emp.job_title == "barber_assistant" and emp.receives_commission:
        if emp.assistant_of_barber_id:
            barber_sales = db.query(func.sum(InvoiceItem.total_price)).join(Invoice).filter(
                Invoice.barber_id == emp.assistant_of_barber_id,
                InvoiceItem.service_id.isnot(None),
                Invoice.created_at >= start_date,
                Invoice.created_at < end_date
            ).scalar()
            if barber_sales:
                rate = Decimal(str(emp.assistant_commission_rate or 0)) / Decimal("100")
                commission_amount = (Decimal(str(barber_sales)) * rate).quantize(Decimal("0.01"))

    # 2. Attendance Metrics
    metrics = calculate_attendance_metrics(db, employee_id, start_date, end_date)
    
    # 3. Logic based on Employment Type
    base_salary = Decimal(str(emp.base_salary or 0))
    bonus = Decimal("0.00")
    discipline_bonus = Decimal("0.00")
    auto_deduction = Decimal("0.00")
    
    if emp.employment_type == "temporary":
        # System "اليومية": Salary is daily rate * actual days
        earned_base = base_salary * metrics["actual_days"]
        # No monthly bonuses or auto-deductions for temporary
    else:
        # Full-time or Part-time (Monthly based)
        earned_base = base_salary
        
        # Attendance Bonus
        if metrics["attendance_percent"] >= (emp.bonus_min_attendance_percent or 0):
            bonus = Decimal(str(emp.fixed_bonus or 0))
            
        # Discipline Bonus
        if (emp.discipline_bonus or 0) > 0 and metrics["missed_days"] == 0:
            discipline_bonus = Decimal(str(emp.discipline_bonus))
            
        # Auto Deduction
        if emp.enable_attendance_auto_deduction:
            # (base_salary / 30) * missed_days
            day_value = base_salary / Decimal("30")
            auto_deduction = (day_value * metrics["missed_days"]).quantize(Decimal("0.01"))
        
    # 4. Advances & Fixed Deductions
    pending_advances_sum = db.query(func.sum(SalaryAdvance.amount)).filter(
        SalaryAdvance.employee_id == emp.id,
        SalaryAdvance.is_deducted == False,
        SalaryAdvance.advance_date < end_date
    ).scalar()
    advance_amount = Decimal(str(pending_advances_sum or 0))
    
    fixed_deductions = Decimal(str(emp.default_deductions or 0))
    
    net_salary = earned_base + commission_amount + bonus + discipline_bonus - (fixed_deductions + advance_amount + auto_deduction)
    
    return {
        "employee_id": employee_id,
        "employee_name": emp.full_name,
        "employment_type": emp.employment_type,
        "base_salary_config": base_salary,
        "earned_base_salary": earned_base,
        "commission_amount": commission_amount,
        "attendance_bonus": bonus,
        "discipline_bonus": discipline_bonus,
        "fixed_deductions": fixed_deductions,
        "auto_deduction": auto_deduction,
        "advance_amount": advance_amount,
        "net_salary": max(Decimal("0.00"), net_salary),
        "metrics": metrics
    }
