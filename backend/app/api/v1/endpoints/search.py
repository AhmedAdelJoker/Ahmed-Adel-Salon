from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Any, List

from app.api import deps
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.service import Service
from app.models.product import Product

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/universal")
def universal_search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Search across multiple entities: Customers, Employees, Invoices, Services.
    """
    search_term = f"%{q}%"
    results = []
    
    user_role = str(current_user.role or "").lower()

    # 1. Search Customers (Visible to all staff)
    customers = db.query(Customer).filter(
        or_(
            Customer.first_name.ilike(search_term),
            Customer.last_name.ilike(search_term),
            Customer.phone.ilike(search_term)
        )
    ).limit(5).all()
    
    for c in customers:
        results.append({
            "id": c.customer_id,
            "label": f"{c.first_name} {c.last_name}".strip(),
            "sub": c.phone,
            "type": "customer",
            "category": "عملاء",
            "to": f"/customers?id={c.customer_id}"
        })

    # 2. Search Employees (Visible to Owner, Admin, Manager)
    if user_role in ["owner", "admin", "manager"]:
        employees = db.query(Employee).filter(
            or_(
                Employee.full_name.ilike(search_term),
                Employee.display_name.ilike(search_term)
            )
        ).limit(5).all()
        for e in employees:
            results.append({
                "id": e.id,
                "label": e.full_name,
                "sub": e.display_name or e.job_title,
                "type": "employee",
                "category": "موظفون",
                "to": f"/owner/hr?id={e.id}"
            })

    # 3. Search Invoices (Visible to Owner, Admin, Manager, Cashier)
    if user_role in ["owner", "admin", "manager", "cashier"]:
        invoices = db.query(Invoice).filter(
            Invoice.invoice_no.ilike(search_term)
        ).limit(5).all()
        for i in invoices:
            results.append({
                "id": i.id,
                "label": i.invoice_no,
                "sub": f"قيمة: {i.final_amount} ج.م",
                "type": "invoice",
                "category": "فواتير",
                "to": f"/invoices?id={i.id}"
            })

    # 4. Search Services (Visible to all)
    services = db.query(Service).filter(
        or_(
            Service.name.ilike(search_term),
            Service.name_ar.ilike(search_term),
            Service.name_en.ilike(search_term)
        )
    ).limit(5).all()
    for s in services:
        results.append({
            "id": s.id,
            "label": s.name_ar or s.name,
            "sub": f"خدمة - {s.price} ج.م",
            "type": "service",
            "category": "خدمات",
            "to": f"/owner/settings?tab=services&id={s.id}"
        })
        
    # 5. Search Products
    products = db.query(Product).filter(
        Product.name.ilike(search_term)
    ).limit(5).all()
    for p in products:
        results.append({
            "id": p.id,
            "label": p.name,
            "sub": f"منتج - {p.price} ج.م",
            "type": "product",
            "category": "منتجات",
            "to": f"/inventory?id={p.id}"
        })

    return results



