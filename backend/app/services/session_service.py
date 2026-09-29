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
from app.models.walk_in_queue import WalkInQueue


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

    # Phase 2: this was three levels of N+1 — one ServiceProduct query per
    # appointment service, then one Product query per service product. An
    # appointment with 3 services each using 2 products cost 1 + 3 + 6 = 10
    # queries. Now it is always 3, regardless of the appointment's shape.
    #
    # Correctness note: the stock deduction below mutates `product.quantity`.
    # Collecting them into a dict is safe because every row comes from the
    # same session, so the identity map returns the *same* Product instance
    # for a repeated id — the read-modify-write never clobbers itself.
    appointment_services = (
        db.query(AppointmentService)
        .filter(AppointmentService.appointment_id == appointment.id)
        .all()
    )
    if not appointment_services:
        return session

    service_ids = {s.service_id for s in appointment_services if s.service_id is not None}
    if not service_ids:
        return session

    service_products = (
        db.query(ServiceProduct)
        .filter(ServiceProduct.service_id.in_(service_ids))
        .all()
    )
    product_ids = {sp.product_id for sp in service_products if sp.product_id is not None}

    products_by_id = {}
    if product_ids:
        products_by_id = {
            p.id: p
            for p in db.query(Product).filter(Product.id.in_(product_ids)).all()
        }

    products_by_service = {}
    for service_product in service_products:
        products_by_service.setdefault(service_product.service_id, []).append(service_product)

    for appointment_service in appointment_services:
        for service_product in products_by_service.get(appointment_service.service_id, []):
            product = products_by_id.get(service_product.product_id)
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


def convert_queue_to_session(
    db: Session,
    queue_id: int,
    created_by_user_id: int | None,
):
    queue_item = db.query(WalkInQueue).filter(WalkInQueue.id == queue_id).first()
    if not queue_item:
        raise HTTPException(status_code=404, detail="عنصر الطابور غير موجود")

    if queue_item.converted_session_id:
        existing_session = (
            db.query(ServiceSession)
            .filter(ServiceSession.id == queue_item.converted_session_id)
            .first()
        )
        if existing_session:
            return existing_session

    assigned_barber_id = (
        queue_item.assigned_employee_id or queue_item.requested_employee_id
    )
    if not assigned_barber_id:
        raise HTTPException(
            status_code=400,
            detail="يجب تعيين مقدم الخدمة قبل تحويل التذكرة إلى جلسة",
        )

    session = ServiceSession(
        appointment_id=None,
        customer_id=queue_item.customer_id,
        barber_id=assigned_barber_id,
        status="active",
        notes=queue_item.queue_note,
        total_price=Decimal("0.00"),
        created_by_user_id=created_by_user_id,
    )
    db.add(session)
    db.flush()
    return session
