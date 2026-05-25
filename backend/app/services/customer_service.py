from sqlalchemy.orm import Session

from app.models.customer import Customer


def get_customers(db: Session) -> list[Customer]:
    return db.query(Customer).order_by(Customer.id.desc()).all()


def get_customer(db: Session, customer_id: int) -> Customer | None:
    return db.query(Customer).filter(Customer.id == customer_id).first()


def create_customer(db: Session, payload) -> Customer:
    item = Customer(
        name=payload.name,
        phone=payload.phone,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_customer(db: Session, item: Customer, payload) -> Customer:
    item.name = payload.name
    item.phone = payload.phone

    db.commit()
    db.refresh(item)
    return item


def delete_customer(db: Session, item: Customer) -> None:
    db.delete(item)
    db.commit()