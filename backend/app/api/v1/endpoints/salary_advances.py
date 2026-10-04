from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.employee import Employee
from app.models.salary_advance import SalaryAdvance
from app.schemas.salary_advance import (
    SalaryAdvanceCreate, SalaryAdvanceRead, SalaryAdvanceUpdate
)

router = APIRouter(prefix="/salary-advances", tags=["Salary Advances"])

@router.get("", response_model=List[SalaryAdvanceRead])
def list_salary_advances(
    db: Session = Depends(get_db),
    employee_id: Optional[int] = None,
    is_deducted: Optional[bool] = None,
    current_user: User = Depends(require_owner_or_manager)
):
    query = db.query(SalaryAdvance).options(joinedload(SalaryAdvance.employee))
    
    if employee_id:
        query = query.filter(SalaryAdvance.employee_id == employee_id)
    if is_deducted is not None:
        query = query.filter(SalaryAdvance.is_deducted == is_deducted)
        
    results = query.order_by(SalaryAdvance.advance_date.desc()).all()
    
    # Map employee name for read schema
    for res in results:
        res.employee_name = res.employee.full_name if res.employee else "Unknown"
        
    return results

from app.models.expense import Expense

@router.post("", response_model=SalaryAdvanceRead, status_code=status.HTTP_201_CREATED)
def create_salary_advance(
    payload: SalaryAdvanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    # Verify employee exists
    employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
        
    db_obj = SalaryAdvance(
        **payload.model_dump(),
        created_by_id=current_user.id
    )
    db.add(db_obj)
    db.flush()
    
    expense = Expense(
        title=f"سلفة موظف: {employee.full_name}",
        description=f"سلفة نقدية. {payload.description or ''}",
        amount=float(payload.amount),
        category="سلف",
        payment_method="cash",
        expense_date=datetime.now(),
        status="approved",
        reference_type="salary_advance",
        reference_id=db_obj.id,
        created_by_user_id=current_user.id,
    )
    db.add(expense)
    db.flush()

    from app.crud.core_business import create_cash_transaction
    create_cash_transaction(
        db,
        direction="out",
        amount=float(payload.amount),
        transaction_type="salary_advance",
        payment_method="cash",
        notes=f"صرف سلفة: {employee.full_name}",
        user_id=current_user.id,
        reference_type="salary_advance",
        reference_id=db_obj.id,
        reference_no=f"ADV-{db_obj.id}",
        employee_id=employee.id,
        commit=False,
    )

    db.commit()
    db.refresh(db_obj)
    
    db_obj.employee_name = employee.full_name
    return db_obj

@router.delete("/{advance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_salary_advance(
    advance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    db_obj = db.query(SalaryAdvance).filter(SalaryAdvance.id == advance_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="السلفة غير موجودة")
        
    if db_obj.is_deducted:
        raise HTTPException(
            status_code=400,
            detail="لا يمكن حذف سلفة تم خصمها بالفعل من الراتب"
        )

    linked_expense = (
        db.query(Expense)
        .filter(
            Expense.reference_type == "salary_advance",
            Expense.reference_id == db_obj.id,
        )
        .first()
    )
    if linked_expense:
        db.delete(linked_expense)

    from app.crud.core_business import (
        create_cash_transaction,
        find_existing_cash_transaction,
    )
    original_transaction = find_existing_cash_transaction(
        db,
        reference_type="salary_advance",
        reference_id=db_obj.id,
        transaction_type="salary_advance",
    )
    if original_transaction:
        create_cash_transaction(
            db,
            direction="in",
            amount=float(original_transaction.amount),
            transaction_type="salary_advance_reversal",
            payment_method=original_transaction.payment_method or "cash",
            notes=f"عكس سلفة رقم {db_obj.id}",
            user_id=current_user.id,
            reference_type="salary_advance",
            reference_id=db_obj.id,
            reference_no=f"ADV-REV-{db_obj.id}",
            employee_id=db_obj.employee_id,
            commit=False,
        )

    db.delete(db_obj)
    db.commit()
    return None



