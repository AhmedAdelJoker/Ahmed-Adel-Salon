from datetime import timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.deps import require_cashier_manager_owner
from app.models.expense import Expense
from app.models.user import User
from app.models.product import Product
from app.models.inventory_log import InventoryLog
from app.core.rate_limit import rate_limit
from app.schemas.product import (
    ProductCreate,
    ProductRead,
    ProductSummary,
    ProductUpdate,
)
from app.schemas.inventory import (
    InventoryAddStockPayload,
    InventoryAdjustPayload,
    InventoryLogListResponse,
    InventoryLogRead,
    InventoryLogSummary,
    InventoryLogWithProductRead,
)
from app.services.inventory_service import add_stock, remove_stock, adjust_stock
from app.services.activity_log_service import log_activity
from app.utils.media import process_image_content, get_upload_path
from app.core.clock import salon_now
from app.core.upload_security import validate_image

router = APIRouter(prefix="/products", tags=["Products Inventory"])

# Roles allowed to make stock-sensitive / money-moving inventory operations.
# Front-desk roles (cashier, accountant) can receive stock and record expenses,
# but cannot edit stocked products, adjust balances or spend the cashbox on
# supplies. Management (owner, admin, manager) can.
MANAGEMENT_ROLES = {"owner", "admin", "manager"}


def _require_management(current_user: User) -> None:
    if (current_user.role or "").lower() not in MANAGEMENT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="هذه العملية للمالك والمدير والأدمن فقط",
        )


def _has_stock(product: Product) -> bool:
    return float(product.quantity or 0) > 0


def _unit_cost_of(
    quantity,
    cost_price,
    sell_price,
    weight,
) -> tuple[Decimal, Decimal]:
    """The money one row of stock is worth: (cost, value).

    `cost_price` and `sell_price` are per *pack*; `weight` is how many base
    units a pack holds. The quantity on the row is in base units. So the row is
    worth `quantity * (price / weight)` -- and a product with no pack size
    keeps its own price, because there one unit is one pack.

    Returned as a pair so the caller does not divide twice, and computed in
    Python because SQLite divides two integers into an integer: `25 / 250` is
    `0` there, not `0.1`, which silently zeroed the pack-priced rows.
    """
    quantity_d = Decimal(str(quantity or 0))
    cost_d = Decimal(str(cost_price or 0))
    price_d = Decimal(str(sell_price or 0))
    weight_d = Decimal(str(weight or 0))

    if weight_d > 0:
        return quantity_d * (cost_d / weight_d), quantity_d * (price_d / weight_d)
    return quantity_d * cost_d, quantity_d * price_d


@router.get("", response_model=list[ProductRead])
def list_products(
    response: Response = None,
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_archived: Optional[bool] = Query(None),
    low_stock: Optional[bool] = Query(None, description="Only products at or below min_quantity_alert"),
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
                # The category is searchable here for the same reason it is in
                # `/products/summary`: the KPI row counts the category, so a
                # search that finds it in one place must find it in the other.
                # Without this, searching a category name showed "1 result" in
                # the KPI and an empty list underneath it.
                Product.category.ilike(search),
                Product.company_name.ilike(search)
            )
        )
    
    if category:
        query = query.filter(Product.category == category)
        
    if is_archived is not None:
        query = query.filter(Product.is_archived == is_archived)

    if low_stock:
        # The archived rows are not on the shelf, so a low-stock filter is
        # about what is there now. The KPI counts the same set (see
        # `/products/summary`), so the banner and the list agree.
        query = query.filter(
            Product.is_archived.is_(False),
            Product.quantity <= Product.min_quantity_alert,
        )

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


@router.get("/summary", response_model=ProductSummary)
def get_products_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
    q: Optional[str] = Query(None),
):
    q_norm = (q or "").strip()
    base = db.query(Product)
    if q_norm:
        search = f"%{q_norm}%"
        base = base.filter(
            or_(
                Product.name.ilike(search),
                Product.sku.ilike(search),
                Product.category.ilike(search),
                Product.company_name.ilike(search),
            )
        )

    total = base.with_entities(func.count(Product.id)).scalar() or 0
    archived = (
        base.with_entities(func.count(Product.id))
        .filter(Product.is_archived.is_(True))
        .scalar()
        or 0
    )
    active = int(total) - int(archived)
    low_stock = (
        base.with_entities(func.count(Product.id))
        .filter(
            Product.is_archived.is_(False),
            Product.quantity <= Product.min_quantity_alert,
        )
        .scalar()
        or 0
    )
    # The money in the shelf is base units times the *unit* price, not times
    # the pack price: `quantity` is grams/millilitres/pieces, while
    # `cost_price` and `sell_price` are per pack. Multiplying grams by the
    # price of a pack overstated the stock by the pack size -- 250x for a 250g
    # pack, 1000x for a litre.
    #
    # Summed in Python rather than SQL, for two reasons. SQLite divides two
    # integers into an integer (`25 / 250` is 0, not 0.1), so the division
    # has to happen somewhere that knows about decimals; and the money is
    # `Decimal` everywhere else, so it stays `Decimal` here too.
    money_rows = (
        base.with_entities(
            Product.quantity,
            Product.cost_price,
            Product.sell_price,
            Product.weight,
        )
        .filter(Product.is_archived.is_(False))
        .all()
    )
    total_cost = Decimal("0")
    total_value = Decimal("0")
    for quantity, cost_price, sell_price, weight in money_rows:
        total_cost += _unit_cost_of(quantity, cost_price, sell_price, weight)[0]
        total_value += _unit_cost_of(quantity, cost_price, sell_price, weight)[1]
    categories = (
        base.with_entities(func.count(func.distinct(Product.category)))
        .filter(Product.category.isnot(None), Product.category != "")
        .scalar()
        or 0
    )
    return ProductSummary(
        total=int(total),
        active=int(active),
        archived=int(archived),
        low_stock=int(low_stock),
        total_cost=total_cost,
        total_value=total_value,
        categories=int(categories),
    )


@router.get("/insights")
def get_products_insights(
    days: int = Query(60, ge=1, le=365),
    limit: int = Query(4, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cashier_manager_owner),
):
    """
    The numbers behind the inventory dashboard.

    `/products/summary` answers "how much is on the shelf"; this answers "where
    is the money and what is moving":

    - `top_by_value`: the lines that hold the most selling value.
    - `most_consumed`: what went out in the last `days` (removals only).
    - `stagnant`: what has not moved in `days` -- including products that were
      created and never received a single movement.
    - `categories`: the composition of the shelf, for the distribution bar.
    - `low_stock`: what is at or below its alert threshold, with a suggested
      reorder quantity (enough to reach twice the threshold).
    - `totals`: units and packs on the shelf, for the page header.

    Archived rows are excluded everywhere: the panel is about the shelf as it
    is now.
    """
    since = salon_now() - timedelta(days=days)

    rows = (
        db.query(
            Product.id,
            Product.name,
            Product.category,
            Product.unit,
            Product.quantity,
            Product.cost_price,
            Product.sell_price,
            Product.weight,
            Product.min_quantity_alert,
        )
        .filter(Product.is_archived.is_(False))
        .all()
    )

    enriched = []
    for (
        product_id,
        name,
        category,
        unit,
        quantity,
        cost_price,
        sell_price,
        weight,
        min_quantity_alert,
    ) in rows:
        cost_part, value_part = _unit_cost_of(quantity, cost_price, sell_price, weight)
        quantity_d = Decimal(str(quantity or 0))
        weight_d = Decimal(str(weight or 0))
        enriched.append(
            {
                "id": product_id,
                "name": name,
                "category": (category or "").strip() or None,
                "unit": unit,
                "quantity": float(quantity_d),
                "min_quantity_alert": float(Decimal(str(min_quantity_alert or 0))),
                "cost": float(cost_part),
                "value": float(value_part),
                "weight": float(weight_d) if weight_d > 0 else 0.0,
            }
        )

    total_units = sum(item["quantity"] for item in enriched)
    total_packs = sum(
        item["quantity"] / item["weight"]
        for item in enriched
        if item["weight"] > 0
    )
    # Lines stocked by the base unit with no pack size (e.g. grams with no
    # pack capacity) get valued at face price -- technically consistent, but
    # the screen must not let a missing `weight` masquerade as a real pack.
    missing_pack_size = sum(
        1
        for item in enriched
        if (item["unit"] or "").lower() not in {"piece", "قطعة", "pieces", "pcs"}
        and item["weight"] == 0
    )
    for item in enriched:
        item.pop("weight", None)

    top_by_value = sorted(enriched, key=lambda item: item["value"], reverse=True)[:limit]

    consumption = (
        db.query(
            InventoryLog.product_id,
            func.sum(-InventoryLog.change_amount).label("used"),
        )
        .filter(
            InventoryLog.type == "remove",
            InventoryLog.created_at >= since,
        )
        .group_by(InventoryLog.product_id)
        .order_by(desc("used"))
        .limit(limit)
        .all()
    )
    by_id = {item["id"]: item for item in enriched}
    most_consumed = []
    for product_id, used in consumption:
        entry = by_id.get(product_id)
        if entry is None:
            continue
        most_consumed.append(
            {
                "id": entry["id"],
                "name": entry["name"],
                "unit": entry["unit"],
                "consumed": float(used or 0),
            }
        )

    last_move_rows = (
        db.query(
            InventoryLog.product_id,
            func.max(InventoryLog.created_at).label("last_movement_at"),
        )
        .group_by(InventoryLog.product_id)
        .all()
    )
    last_move = {int(product_id): last for product_id, last in last_move_rows}
    stagnant = []
    for item in enriched:
        if item["quantity"] <= 0:
            continue
        last = last_move.get(item["id"])
        if last is not None and last >= since:
            continue
        stagnant.append(
            {
                "id": item["id"],
                "name": item["name"],
                "unit": item["unit"],
                "quantity": item["quantity"],
                "value": item["value"],
                "last_movement_at": last.isoformat() if last is not None else None,
            }
        )
    # Most expensive dead weight first -- the ones worth acting on.
    stagnant.sort(key=lambda item: item["value"], reverse=True)
    stagnant = stagnant[:limit]

    categories: dict[str, dict[str, float]] = {}
    for item in enriched:
        key = item["category"] or "—"
        bucket = categories.setdefault(key, {"count": 0, "value": 0.0, "cost": 0.0})
        bucket["count"] += 1
        bucket["value"] += item["value"]
        bucket["cost"] += item["cost"]
    category_list = [
        {"category": key, "count": int(bucket["count"]), "value": bucket["value"], "cost": bucket["cost"]}
        for key, bucket in categories.items()
    ]
    category_list.sort(key=lambda item: item["value"], reverse=True)

    low_stock = [
        {
            "id": item["id"],
            "name": item["name"],
            "unit": item["unit"],
            "quantity": item["quantity"],
            "min_quantity_alert": item["min_quantity_alert"],
            # Enough to reach twice the threshold.
            "suggested": float(max(0.0, 2 * item["min_quantity_alert"] - item["quantity"])),
        }
        for item in enriched
        if item["min_quantity_alert"] > 0 and item["quantity"] <= item["min_quantity_alert"]
    ]
    low_stock.sort(key=lambda item: item["suggested"], reverse=True)

    return {
        "days": days,
        "totals": {
            "units": total_units,
            "packs": total_packs,
            "lines": len(enriched),
            "missing_pack_size": int(missing_pack_size),
        },
        "top_by_value": top_by_value,
        "most_consumed": most_consumed,
        "stagnant": stagnant,
        "categories": category_list[:8],
        "low_stock": low_stock[:12],
    }


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

    # Stock before/after each movement, derived from the live quantity:
    #   stock_after  = current_qty - (sum of movements that came *after* this one)
    #
    # That "sum of later movements" is a running total, so it is computed once
    # for the whole page with a window function rather than one aggregate query
    # per row. The original loop issued up to `page_size` SUM queries — 200 on a
    # full page — and `product_id` could not use the idempotency index because
    # that constraint lists it third, so each one was a full scan.
    #
    # SQLite has supported window functions since 3.25 and PostgreSQL since 8.4,
    # so this needs no dialect branch and no extra dependency.
    #
    # The frame is `ORDER BY id ASC` + `ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED
    # FOLLOWING`, i.e. every movement with a *greater* id — the ones that came
    # after this one chronologically.
    #
    # Ordering descending and taking "1 FOLLOWING" looks equivalent and is not:
    # over a descending sequence "following" means the next element *down*, so
    # the frame would cover the movements that came *before*. The running
    # balance came out reversed while still looking like a plausible stock
    # level, which is why the test asserts the numbers and not just the count.
    product_ids = {log.product_id for log in rows if log.product_id is not None}
    later_sums: dict[tuple[int, int], Decimal] = {}

    if product_ids:
        running = (
            db.query(
                InventoryLog.product_id.label("product_id"),
                InventoryLog.id.label("log_id"),
                func.sum(InventoryLog.change_amount)
                .over(
                    partition_by=InventoryLog.product_id,
                    order_by=InventoryLog.id.asc(),
                    # Everything strictly after the current row.
                    rows=(1, None),
                )
                .label("later_sum"),
            )
            .filter(InventoryLog.product_id.in_(product_ids))
            .subquery()
        )
        for product_id, log_id, later_sum in db.query(running).all():
            later_sums[(product_id, log_id)] = Decimal(str(later_sum or 0))

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
        later_sum = later_sums.get((log.product_id, log.id), Decimal("0"))
        current_qty = (
            log.product.quantity
            if log.product is not None and log.product.quantity is not None
            else 0
        )
        stock_after = Decimal(str(current_qty)) - later_sum
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
    product.is_active = not bool(getattr(product, "is_archived", False))
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

    # A product that has stock is live inventory: only management may edit it.
    # Quantity itself is never changed here (it moves through stock logs).
    if _has_stock(product):
        _require_management(current_user)

    # Update fields except quantity (which is managed via logs).
    #
    # `exclude_unset` matters for the two flags: `ProductUpdate` defaults
    # `is_active=True` and `is_archived=False`, so a plain `model_dump()`
    # filled them in even when the client had not mentioned them -- which
    # quietly un-archived a product the moment someone edited its name.
    data = payload.model_dump(exclude_unset=True)
    if "quantity" in data:
        del data["quantity"]

    for field, value in data.items():
        setattr(product, field, value)
    if "is_archived" in data:
        product.is_active = not bool(product.is_archived)

    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.post(
    "/{product_id}/add-stock",
    response_model=ProductRead,
    dependencies=[Depends(rate_limit("products_add_stock", max_requests=30, window_seconds=60))],
)
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
    if payload.create_expense:
        # Cashiers must not book spend into suppliers/cashbox; that is a
        # management decision. They can still receive stock into the shelf.
        _require_management(current_user)

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
    product.is_active = True

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
        from app.crud.core_business import create_cash_transaction
        try:
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
        except ValueError as e:
            # الرصيد لا يستوعب الصرف — لا تكتمل عملية المخزون بدون
            # حركتها في الخزينة: نفشل العملية كلها مع رسالة واضحة.
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    db.refresh(product)

    log_activity(
        db,
        user_id=current_user.id,
        action="ADD_STOCK",
        entity_type="Product",
        entity_id=str(product.id),
        description=f"توريد {payload.amount} {product.unit} للصنف {product.name}",
    )

    # Return enriched response if price changed to notify frontend
    return product


@router.patch(
    "/{product_id}/update-prices",
    dependencies=[Depends(rate_limit("products_update_prices", max_requests=30, window_seconds=60))],
)
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

    # Editing the price of a stocked product is a management decision.
    if _has_stock(product):
        _require_management(current_user)

    if sell_price is not None:
        if sell_price < 0:
            raise HTTPException(status_code=400, detail="سعر البيع لا يمكن أن يكون سالباً")
        product.sell_price = sell_price
    if cost_price is not None:
        if cost_price < 0:
            raise HTTPException(status_code=400, detail="سعر التكلفة لا يمكن أن يكون سالباً")
        product.cost_price = cost_price
        
    db.commit()
    log_activity(
        db,
        user_id=current_user.id,
        action="UPDATE_PRICES",
        entity_type="Product",
        entity_id=str(product_id),
        description=f"تعديل أسعار {product.name}: بيع={product.sell_price} تكلفة={product.cost_price}",
    )
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

    _require_management(current_user)

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
        product.is_active = False

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

    _require_management(current_user)

    product.is_archived = not product.is_archived
    product.is_active = not product.is_archived
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

    _require_management(current_user)

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


@router.post(
    "/upload-image",
    dependencies=[Depends(rate_limit("products_upload_image", max_requests=20, window_seconds=60))],
)
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
    """Update product image URL. Management only."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    # Only self-served uploads are accepted — an arbitrary URL here would
    # inject an external resource into every product card.
    if image_url and not image_url.startswith("/uploads/products/"):
        raise HTTPException(status_code=422, detail="رابط الصورة يجب أن يكون من رفع الملفات الداخلية")
    _require_management(current_user)
    product.image_url = image_url
    db.commit()
    db.refresh(product)
    return product
