from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.models.employee import Employee

def get_employees(db: Session) -> list[Employee]:
    return db.query(Employee).order_by(Employee.id.desc()).all()

def get_employee(db: Session, employee_id: int) -> Employee | None:
    return db.query(Employee).filter(Employee.id == employee_id).first()

def delete_employee(db: Session, item: Employee) -> None:
    db.delete(item)
    db.commit()



