from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_any_staff
from app.models.user import User
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("")
def list_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    include_deleted: bool = False,
):
    query = db.query(Customer)
    if not include_deleted:
        query = query.filter(Customer.is_active == True)
        
    if q:
        search = f"%{q}%"
        # Enhanced search: names, full phone, OR last 4 digits matching
        condition = (
            (Customer.first_name.ilike(search)) | 
            (Customer.last_name.ilike(search)) | 
            (Customer.phone.ilike(search))
        )
        
        # Expert Feature: If search query is digits and >= 4 chars, match tail of phone
        if q.isdigit() and len(q) >= 4:
            condition = condition | (Customer.phone.like(f"%{q}"))
            
        query = query.filter(condition)
    
    total = query.count()
    items = query.order_by(Customer.customer_id.desc()).offset(skip).limit(limit).all()
    
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    return customer


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    # Check if a deleted customer with same phone exists, if so reactivate
    existing_deleted = db.query(Customer).filter(
        Customer.phone == payload.phone, 
        Customer.is_active == False
    ).first()
    
    if existing_deleted:
        update_data = payload.model_dump()
        for field, value in update_data.items():
            setattr(existing_deleted, field, value)
        existing_deleted.is_active = True
        db.commit()
        db.refresh(existing_deleted)
        return existing_deleted

    payload_data = payload.model_dump()
    payload_data["last_name"] = payload_data.get("last_name") or ""
    customer = Customer(**payload_data)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    update_data = payload.model_dump(exclude_unset=True)
    if "last_name" in update_data:
        update_data["last_name"] = update_data.get("last_name") or ""
    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    # Soft delete: set is_active to False instead of deleting from DB
    customer.is_active = False
    db.commit()
    return None



