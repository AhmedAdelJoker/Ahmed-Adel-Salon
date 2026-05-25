from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.service_product import ServiceProduct
from app.models.product import Product
from app.models.service_session import ServiceSession
from app.models.session_product import SessionProduct
from app.models.inventory_log import InventoryLog


def create_session_from_appointment(db: Session, *, appointment: Appointment, created_by_user_id: int | None, notes: str | None = None):
    existing_session = db.query(ServiceSession).filter(ServiceSession.appointment_id == appointment.id).first()
    if existing_session:
        raise HTTPException(status_code=400, detail="تم إنشاء جلسة لهذا الحجز بالفعل")

    session = ServiceSession(
        appointment_id=appointment.id,
        customer_id=appointment.customer_id,
        barber_id=appointment.barber_id,
        status="active",
        notes=notes,
        total_price=Decimal(str(appointment.total_estimated_price or 0)),
        created_by_user_id=created_by_user_id,
    )
    db.add(session)
    db.flush()

    appointment_services = db.query(AppointmentService).filter(AppointmentService.appointment_id == appointment.id).all()
    for appointment_service in appointment_services:
        service_products = db.query(ServiceProduct).filter(ServiceProduct.service_id == appointment_service.service_id).all()
        for service_product in service_products:
            product = db.query(Product).filter(Product.id == service_product.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"المنتج المرتبط بالخدمة غير موجود: {service_product.product_id}")
            quantity_used = Decimal(str(service_product.amount_used or 0)) * Decimal(str(appointment_service.quantity or 1))
            current_qty = Decimal(str(product.quantity or 0))
            if current_qty < quantity_used:
                raise HTTPException(status_code=400, detail=f"المخزون غير كافٍ للمنتج {product.name}")
            product.quantity = current_qty - quantity_used
            db.add(product)
            db.add(SessionProduct(session_id=session.id, product_id=product.id, quantity_used=quantity_used))
            db.add(InventoryLog(
                product_id=product.id,
                change_amount=-quantity_used,
                type="auto_from_session",
                note=f"خصم تلقائي من الجلسة #{session.id}",
                created_by_user_id=created_by_user_id,
            ))
    return session


def create_manual_session(db: Session, *, customer_id: int, barber_id: int, appointment_id: int | None, notes: str | None, created_by_user_id: int | None):
    session = ServiceSession(
        appointment_id=appointment_id,
        customer_id=customer_id,
        barber_id=barber_id,
        status="active",
        notes=notes,
        total_price=Decimal("0.00"),
        created_by_user_id=created_by_user_id,
    )
    db.add(session)
    db.flush()
    return session
