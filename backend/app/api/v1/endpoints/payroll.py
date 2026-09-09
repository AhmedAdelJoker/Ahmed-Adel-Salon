from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.api.deps import require_owner_or_manager, require_any_staff
from app.models.user import User
from app.models.employee import Employee
from app.models.payroll_record import PayrollRecord
from app.models.salary_advance import SalaryAdvance
from app.models.expense import Expense
from app.schemas.payroll import (
    PayrollCreate, PayrollRead, PayrollUpdate, 
    PayrollSummary, PayrollArchiveResponse, PayrollCalculateRequest
)

router = APIRouter(prefix="/payroll", tags=["Payroll"])

@router.get("", response_model=List[PayrollRead])
def list_payrolls(
    db: Session = Depends(get_db),
    month: Optional[int] = None,
    year: Optional[int] = None,
    employee_id: Optional[int] = None,
    current_user: User = Depends(require_owner_or_manager)
):
    query = db.query(PayrollRecord)
    if month:
        query = query.filter(PayrollRecord.period_month == month)
    if year:
        query = query.filter(PayrollRecord.period_year == year)
    if employee_id:
        query = query.filter(PayrollRecord.employee_id == employee_id)
    return query.order_by(PayrollRecord.created_at.desc()).all()


@router.get("/all", response_model=List[PayrollRead])
def list_all_payrolls(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    return db.query(PayrollRecord).order_by(PayrollRecord.created_at.desc()).all()

from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from decimal import Decimal

from app.services import payroll_service

@router.get("/expected-net")
def get_expected_net(
    employee_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff)
):
    # If not owner/manager, can only see their own
    target_id = employee_id
    if current_user.role not in ["owner", "manager", "admin"]:
        # Find employee linked to this user
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee record not found for this user")
        target_id = emp.id
    
    if not target_id:
        raise HTTPException(status_code=400, detail="employee_id is required for managers/owners")
        
    now = datetime.now()
    m = month or now.month
    y = year or now.year
    
    return payroll_service.calculate_expected_net_salary(db, target_id, m, y)

@router.post("/calculate", response_model=List[PayrollRead])
def calculate_payroll(
    req: PayrollCalculateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    results = []
    
    # Calculate period date range
    start_date = datetime(req.year, req.month, 1)
    if req.month == 12:
        end_date = datetime(req.year + 1, 1, 1)
    else:
        end_date = datetime(req.year, req.month + 1, 1)

    # Fetch active employees
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    
    for emp in employees:
        existing = db.query(PayrollRecord).filter(
            PayrollRecord.employee_id == emp.id,
            PayrollRecord.period_month == req.month,
            PayrollRecord.period_year == req.year
        ).first()
        
        if existing and existing.status != "cancelled" and existing.status != "draft":
            results.append(existing)
            continue
            
        # Use the smart calculation service
        calc = payroll_service.calculate_expected_net_salary(db, emp.id, req.month, req.year)
        
        commission_amount = calc["commission_amount"]
        advance_amount = calc["advance_amount"]
        bonus = calc["attendance_bonus"] + calc["discipline_bonus"]
        deductions = calc["fixed_deductions"] + calc["auto_deduction"]
        net_salary = calc["net_salary"]

        if existing: # if draft or cancelled, we can reuse or update
             existing.commission_amount = commission_amount
             existing.bonus_amount = bonus
             existing.deduction_amount = deductions
             existing.advance_amount = advance_amount
             existing.net_salary = net_salary
             existing.status = "calculated"
             new_record = existing
        else:
            new_record = PayrollRecord(
                employee_id=emp.id,
                employee_name_snapshot=emp.full_name or emp.display_name or "موظف غير معروف",
                role_snapshot=emp.job_title.upper() if emp.job_title else "STAFF",
                period_month=req.month,
                period_year=req.year,
                base_salary=emp.base_salary, 
                commission_amount=commission_amount,
                bonus_amount=bonus,
                deduction_amount=deductions,
                advance_amount=advance_amount,
                net_salary=net_salary,
                status="calculated",
                created_by_id=current_user.id
            )
            db.add(new_record)
        
        results.append(new_record)
    
    db.commit()
    for r in results:
        db.refresh(r)
        
    return results

@router.get("/summary", response_model=PayrollSummary)
def get_payroll_summary(
    month: int = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    records = db.query(PayrollRecord).filter(
        PayrollRecord.period_month == month,
        PayrollRecord.period_year == year
    ).all()
    
    summary = {
        "month": month,
        "year": year,
        "total_base_salary": sum(r.base_salary for r in records),
        "total_commissions": sum(r.commission_amount for r in records),
        "total_bonuses": sum(r.bonus_amount for r in records),
        "total_deductions": sum(r.deduction_amount for r in records),
        "total_advances": sum(r.advance_amount for r in records),
        "total_net_salary": sum(r.net_salary for r in records),
        "paid_total": sum(r.net_salary for r in records if r.status == "paid"),
        "unpaid_total": sum(r.net_salary for r in records if r.status != "paid"),
        "employees_count": len(records)
    }
    return summary

@router.get("/archive", response_model=PayrollArchiveResponse)
def get_payroll_archive(
    db: Session = Depends(get_db),
    start_month: Optional[int] = None,
    start_year: Optional[int] = None,
    end_month: Optional[int] = None,
    end_year: Optional[int] = None,
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_owner_or_manager)
):
    query = db.query(PayrollRecord)
    
    if start_year:
        query = query.filter(PayrollRecord.period_year >= start_year)
    if end_year:
        query = query.filter(PayrollRecord.period_year <= end_year)
    
    if employee_id:
        query = query.filter(PayrollRecord.employee_id == employee_id)
    if status:
        query = query.filter(PayrollRecord.status == status)
    if q:
        query = query.filter(PayrollRecord.employee_name_snapshot.ilike(f"%{q}%"))

    total = query.count()
    items = query.order_by(PayrollRecord.period_year.desc(), PayrollRecord.period_month.desc())\
                 .offset(skip).limit(limit).all()

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post("", response_model=PayrollRead, status_code=status.HTTP_201_CREATED)
def create_payroll(
    payload: PayrollCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner_or_manager)
):
    new_record = PayrollRecord(**payload.model_dump(), created_by_id=current_user.id)
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@router.get("/{payroll_id}", response_model=PayrollRead)
def get_payroll(
    payroll_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner_or_manager)
):
    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    return record

@router.put("/{payroll_id}", response_model=PayrollRead)
def update_payroll(
    payroll_id: int, 
    payload: PayrollUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner_or_manager)
):
    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)
    
    db.commit()
    db.refresh(record)
    return record

@router.post("/{payroll_id}/audit", response_model=PayrollRead)
def audit_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    
    if record.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot audit paid payroll")
        
    record.status = "audited"
    db.commit()
    db.refresh(record)
    return record

@router.post("/{payroll_id}/pay", response_model=PayrollRead)
def pay_payroll(
    payroll_id: int,
    payment_data: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    
    if record.status == "paid":
        raise HTTPException(status_code=400, detail="Payroll already paid")
        
    try:
        record.status = "paid"
        record.payment_date = datetime.now()
        if payment_data and "payment_method" in payment_data:
            record.payment_method = payment_data["payment_method"]
        
        # Create Expense
        title = f"راتب {record.employee_name_snapshot} - {record.period_month}/{record.period_year}"
        new_expense = Expense(
            title=title,
            description=f"تم إنشاء هذا المصروف تلقائياً من نظام الرواتب. {record.notes or ''}",
            amount=record.net_salary,
            category="رواتب",
            payment_method=record.payment_method or "cash",
            expense_date=datetime.now(),
            status="approved",
            created_by_user_id=current_user.id
        )
        db.add(new_expense)
        db.flush()
        
        record.expense_id = new_expense.id
        
        # Mark advances as deducted
        if record.advance_amount > 0:
            # End date of the period
            if record.period_month == 12:
                end_date = datetime(record.period_year + 1, 1, 1)
            else:
                end_date = datetime(record.period_year, record.period_month + 1, 1)
                
            db.query(SalaryAdvance).filter(
                SalaryAdvance.employee_id == record.employee_id,
                SalaryAdvance.is_deducted == False,
                SalaryAdvance.advance_date < end_date
            ).update({
                "is_deducted": True,
                "payroll_record_id": record.id
            }, synchronize_session=False)

        db.commit()
        db.refresh(record)
        return record
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{payroll_id}/cancel", response_model=PayrollRead)
def cancel_payroll(
    payroll_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner_or_manager)
):
    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    
    record.status = "cancelled"
    db.commit()
    db.refresh(record)
    return record

@router.delete("/{payroll_id}")
def delete_payroll(
    payroll_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner_or_manager)
):
    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    
    if record.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot delete paid payroll")
        
    db.delete(record)
    db.commit()
    return {"message": "Payroll record deleted successfully"}



