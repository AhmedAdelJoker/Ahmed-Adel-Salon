from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_any_staff
from app.models.user import User
from app.models.customer import Customer
from app.models.appointment import Appointment
from app.models.barber import Barber
from app.schemas.customer import (
    CustomerCreate,
    CustomerRead,
    CustomerSearchRead,
    CustomerUpdate,
)

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=list[CustomerRead])
def list_customers(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    return db.query(Customer).order_by(Customer.customer_id.desc()).offset(offset).limit(limit).all()


@router.get("/search", response_model=CustomerSearchRead)
def search_customer_by_phone(
    phone: str = Query(..., min_length=5, max_length=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    customer = db.query(Customer).filter(Customer.phone == phone).first()
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")

    visits_count = (
        db.query(Appointment)
        .filter(Appointment.customer_id == customer.customer_id)
        .count()
    )
    latest_appointment = (
        db.query(Appointment, Barber.display_name.label("barber_name"))
        .outerjoin(Barber, Barber.id == Appointment.barber_id)
        .filter(Appointment.customer_id == customer.customer_id)
        .order_by(Appointment.id.desc())
        .first()
    )

    return CustomerSearchRead(
        customer_id=customer.customer_id,
        first_name=customer.first_name,
        last_name=customer.last_name,
        phone=customer.phone,
        email=customer.email,
        created_at=customer.created_at,
        last_employee_name=latest_appointment.barber_name if latest_appointment else None,
        visits_count=visits_count,
    )


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
    customer = Customer(
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        email=payload.email,
    )
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

    customer.first_name = payload.first_name
    customer.last_name = payload.last_name
    customer.phone = payload.phone
    customer.email = payload.email

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

    db.delete(customer)
    db.commit()
    return None
