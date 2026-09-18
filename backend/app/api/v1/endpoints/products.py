from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner
from app.models.expense import Expense
from app.models.user import User
from app.models.product import Product
from app.models.inventory_log import InventoryLog
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.schemas.inventory import (
    InventoryAddStockPayload,
    InventoryAdjustPayload,
    InventoryLogListResponse,
    InventoryLogRead,
    InventoryLogSummary,
    InventoryLogWithProductRead,
)
from app.services.inventory_service import add_stock, remove_stock, adjust_stock
from app.utils.media import process_image_content, get_upload_path
from app.core.upload_security import validate_image

router = APIRouter(prefix="/products", tags=["Products Inventory"])


def _get_estimated_gram_cost(product: Product) -> Decimal:
    weight = Decimal(str(product.weight or 0))
    cost_price = Decimal(str(product.cost_price or 0))

    if weight > 0:
        return cost_price / weight
    if (product.unit or "g").lower() == "g":
        return cost_price
    return Decimal("0")


@router.get("", response_model=list[ProductRead])
def list_products(
    response: Response = None,
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_archived: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    skip: int = Query(0, ge=0, description="Alias for offset"),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=1000),
    sort: Optional[str] = Query(None, description="Sort field. '-' prefix for DESC"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    query = db.query(Product)
    
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                Product.name.ilike(search),
                Product.sku.ilike(search),
                Product.company_name.ilike(search)
            )
        )
    
    if category:
        query = query.filter(Product.category == category)
        
    if is_archived is not None:
        query = query.filter(Product.is_archived == is_archived)

    # Phase 2: optional explicit sort
    if sort:
        sort_field = sort.lstrip("-")
        desc = sort.startswith("-")
        column = getattr(Product, sort_field, None)
        if column is not None:
            query = query.order_by(column.desc() if desc else column.asc())
    else:
        query = query.order_by(Product.id.desc())

    # Phase 2: normalize page/page_size → offset/limit
    eff_offset = offset
    eff_limit = limit
    if page is not None and page_size is not None:
        eff_offset = (page - 1) * page_size
        eff_limit = page_size
    elif skip > 0:
        eff_offset = skip

    # Phase 2: count + headers
    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)
    return query.offset(eff_offset).limit(eff_limit).all()


@router.get("/logs/all", response_model=InventoryLogListResponse)
def list_all_inventory_logs(
    response: Response = None,
    type: Optional[str] = Query(None), # add, remove, adjust
    product_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None, description="بحث في الملاحظة أو اسم الصنف"),
    from_date: Optional[str] = Query(None, description="تاريخ البداية YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="تاريخ النهاية YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """
    سجل الحركات المخزنية مع الترقيم (pagination).
    يدعم الفلترة بالنوع/المنتج، البحث في الملاحظة واسم الصنف، ومدى التاريخ.
    يرجع ملخصاً محسوباً على كامل النطاق المفلتر (قبل الترقيم).
    """
    from datetime import datetime

    filters = []
    if type:
        filters.append(InventoryLog.type == type)
    if product_id:
        filters.append(InventoryLog.product_id == product_id)
    if q:
        search = f"%{q}%"
        or_filters = [
            InventoryLog.note.ilike(search),
            InventoryLog.product.has(Product.name.ilike(search)),
        ]
        # Allow searching by movement number (e.g. "123")
        try:
            or_filters.append(InventoryLog.id == int(str(q).strip()))
        except (ValueError, TypeError):
            pass
        filters.append(or_(*or_filters))
    if from_date:
        try:
            start_dt = datetime.strptime(from_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="صيغة from_date غير صحيحة. استخدم YYYY-MM-DD")
        filters.append(InventoryLog.created_at >= start_dt)
    if to_date:
        try:
            end_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="صيغة to_date غير صحيحة. استخدم YYYY-MM-DD")
        filters.append(InventoryLog.created_at <= end_dt)

    base = db.query(InventoryLog)
    if filters:
        base = base.filter(*filters)

    total = base.count()
    adds = base.filter(InventoryLog.type == "add").count()
    removes = base.filter(InventoryLog.type == "remove").count()
    net = (
        db.query(func.coalesce(func.sum(InventoryLog.change_amount), 0))
        .filter(*filters)
        .scalar()
        if filters
        else db.query(func.coalesce(func.sum(InventoryLog.change_amount), 0)).scalar()
    ) or 0

    rows = (
        base.options(
            joinedload(InventoryLog.product),
            joinedload(InventoryLog.created_by_user),
        )
        .order_by(InventoryLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for log in rows:
        # Creator display name (no extra query — joined above)
        creator = getattr(log, "created_by_user", None)
        created_by_name = None
        if creator is not None:
            created_by_name = (
                getattr(creator, "full_name", None)
                or getattr(creator, "username", None)
                or None
            )
        # Stock before/after this movement, derived from the live quantity:
        # stock_after = current_qty - (sum of later movements for this product)
        later_sum = (
            db.query(func.coalesce(func.sum(InventoryLog.change_amount), 0))
            .filter(
                InventoryLog.product_id == log.product_id,
                InventoryLog.id > log.id,
            )
            .scalar()
            or 0
        )
        current_qty = (
            log.product.quantity
            if log.product is not None and log.product.quantity is not None
            else 0
        )
        stock_after = Decimal(str(current_qty)) - Decimal(str(later_sum))
        stock_before = stock_after - Decimal(str(log.change_amount or 0))
        items.append(
            InventoryLogWithProductRead(
                id=log.id,
                product_id=log.product_id,
                change_amount=log.change_amount,
                type=log.type,
                note=log.note,
                created_by_user_id=log.created_by_user_id,
                created_at=log.created_at,
                product_name=log.product.name if log.product else None,
                product_category=log.product.category if log.product else None,
                product_unit=log.product.unit if log.product else None,
                created_by_name=created_by_name,
                stock_before=stock_before,
                stock_after=stock_after,
            )
        )

    # Phase 2: also expose X-Total-Count header for clients that prefer headers
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(page_size)
        response.headers["X-Page"] = str(page)

    return InventoryLogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        summary=InventoryLogSummary(
            total=total,
            adds=adds,
            removes=removes,
            net=net,
        ),
    )


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    return product


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    # Create Product with 0 quantity
    product = Product(**payload.model_dump())
    product.quantity = 0
    db.add(product)
    db.commit()
    db.refresh(product)
    return product



@router.put("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    # Update fields except quantity (which is managed via logs)
    data = payload.model_dump()
    if "quantity" in data:
        del data["quantity"]

    for field, value in data.items():
        setattr(product, field, value)

    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/add-stock", response_model=ProductRead)
def add_product_stock(
    product_id: int,
    payload: InventoryAddStockPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    # If purchase price is provided and different from current cost_price, update it
    price_changed = False
    if payload.purchase_price is not None and Decimal(str(payload.purchase_price)) != Decimal(str(product.cost_price or 0)):
        product.cost_price = Decimal(str(payload.purchase_price))
        price_changed = True

    # Amount in packs is multiplied by weight to get total quantity in units (g/ml)
    # If weight is not set, we assume 1 unit = 1 pack (e.g. piece)
    multiplier = Decimal(str(product.weight or 1))
    total_units = Decimal(str(payload.amount)) * multiplier

    add_stock(
        db,
        product=product,
        amount=total_units,
        note=payload.note or f"توريد {payload.amount} عبوة",
        created_by_user_id=current_user.id,
    )
    
    # Auto-unarchive when adding stock
    product.is_archived = False

    pending_expense = None
    if payload.create_expense:
        total_cost = Decimal(str(payload.purchase_price or product.cost_price or 0)) * Decimal(str(payload.amount))
        expense_note = payload.note or f"توريد مخزون للمنتج {product.name} ({payload.amount} عبوة)"
        if price_changed:
            expense_note += f" - [تغير في سعر الشراء إلى {product.cost_price}]"
        if payload.invoice_image_url:
            expense_note = f"{expense_note}\nمرفق: {payload.invoice_image_url}"
        pending_expense = Expense(
            amount=float(total_cost),
            category="مشتريات مخزون",
            description=expense_note,
            recipient_name=product.company_name or product.name,
            payment_method="cash",
            status="approved",
            created_by_user_id=current_user.id,
        )
        db.add(pending_expense)
        db.flush()

    # إذا كان مشتريات، سجل حركة خزنة (كاش افتراضياً) — ديناميكي
    if pending_expense is not None and pending_expense.amount and float(pending_expense.amount) > 0:
        try:
            from app.crud.core_business import create_cash_transaction
            create_cash_transaction(
                db,
                direction="out",
                amount=float(pending_expense.amount),
                transaction_type="expense_payment",
                payment_method="cash",
                notes=f"مشتريات مخزون: {product.name} ({payload.amount} عبوة)",
                user_id=current_user.id,
                reference_type="expense",
                reference_id=pending_expense.id,
                reference_no=f"EXP-{pending_expense.id}",
                commit=False,
            )
        except Exception as _e:
            print(f"[Cashbox] purchase auto-withdraw failed: {_e}")

    db.commit()
    db.refresh(product)
    
    # Return enriched response if price changed to notify frontend
    return product


@router.patch("/{product_id}/update-prices")
def update_product_prices(
    product_id: int,
    sell_price: Optional[Decimal] = Query(None),
    cost_price: Optional[Decimal] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    
    if sell_price is not None:
        product.sell_price = sell_price
    if cost_price is not None:
        product.cost_price = cost_price
        
    db.commit()
    return {"status": "success", "sell_price": product.sell_price, "cost_price": product.cost_price}


@router.post("/{product_id}/remove-stock", response_model=ProductRead)
def remove_product_stock(
    product_id: int,
    payload: InventoryAdjustPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    remove_stock(
        db,
        product=product,
        amount=payload.amount,
        note=payload.note,
        created_by_user_id=current_user.id,
    )
    
    # Auto-archive if quantity hits zero
    if product.quantity <= 0:
        product.is_archived = True

    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/toggle-archive", response_model=ProductRead)
def toggle_product_archive(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    product.is_archived = not product.is_archived
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/adjust-stock", response_model=ProductRead)
def adjust_product_stock(
    product_id: int,
    payload: InventoryAdjustPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    adjust_stock(
        db,
        product=product,
        new_quantity=payload.amount,
        note=payload.note,
        created_by_user_id=current_user.id,
    )

    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}/logs", response_model=list[InventoryLogRead])
def get_product_logs(
    product_id: int,
    response: Response = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    # Phase 2: was returning ALL logs unbounded
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    query = (
        db.query(InventoryLog)
        .filter(InventoryLog.product_id == product_id)
        .order_by(InventoryLog.id.desc())
    )

    eff_offset = offset
    eff_limit = limit
    if page is not None and page_size is not None:
        eff_offset = (page - 1) * page_size
        eff_limit = page_size

    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page-Size"] = str(eff_limit)
        if page is not None:
            response.headers["X-Page"] = str(page)
    return query.offset(eff_offset).limit(eff_limit).all()


@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Upload a product image and return the URL."""
    # Phase 3: validate MIME/size/filename before processing
    content = await validate_image(file, max_size=5 * 1024 * 1024)
    upload_dir = get_upload_path("products")
    filename = process_image_content(content, file.filename, upload_dir)
    return {"url": f"/uploads/products/{filename}"}


@router.patch("/{product_id}/update-image", response_model=ProductRead)
def update_product_image(
    product_id: int,
    image_url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """Update product image URL. Owner only."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    product.image_url = image_url
    db.commit()
    db.refresh(product)
    return product
