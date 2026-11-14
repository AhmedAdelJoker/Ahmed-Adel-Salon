from decimal import Decimal

from app.models.product import Product
from tests.helpers import auth_headers, make_user


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def _add_product(db_session, **fields):
    product = Product(**fields)
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def test_list_products_requires_auth(client):
    resp = client.get("/api/v1/products")
    assert resp.status_code in (401, 403)


def test_list_products_empty(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/products", headers=auth_headers(client))
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_get_product_not_found(client, db_session):
    make_user(db_session)
    resp = client.get("/api/v1/products/999999", headers=auth_headers(client))
    assert resp.status_code == 404


def test_summary_values_stock_at_unit_price(client, db_session):
    """A pack-priced product is worth its base units, not its pack price.

    `cost_price`/`sell_price` describe one pack and `weight` is how many base
    units that pack holds, while `quantity` is already in base units. 100g of a
    250g pack that costs 25 must therefore be worth 10, not 2,500.
    """
    headers = _owner_headers(client, db_session)
    _add_product(
        db_session,
        name="Gel",
        unit="g",
        quantity=Decimal("100"),
        cost_price=Decimal("25"),
        sell_price=Decimal("40"),
        weight=Decimal("250"),
    )

    resp = client.get("/api/v1/products/summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert Decimal(str(body["total_cost"])) == Decimal("10")
    assert Decimal(str(body["total_value"])) == Decimal("16")


def test_summary_treats_a_product_without_pack_size_as_one_unit(client, db_session):
    headers = _owner_headers(client, db_session)
    _add_product(
        db_session,
        name="Wax",
        unit="piece",
        quantity=Decimal("3"),
        cost_price=Decimal("40"),
        sell_price=Decimal("60"),
        weight=None,
    )

    resp = client.get("/api/v1/products/summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert Decimal(str(body["total_cost"])) == Decimal("120")
    assert Decimal(str(body["total_value"])) == Decimal("180")


def test_low_stock_kpi_matches_the_low_stock_list_and_skips_archived(
    client, db_session
):
    headers = _owner_headers(client, db_session)
    _add_product(
        db_session,
        name="Low",
        unit="piece",
        quantity=Decimal("1"),
        min_quantity_alert=Decimal("5"),
    )
    _add_product(
        db_session,
        name="Enough",
        unit="piece",
        quantity=Decimal("50"),
        min_quantity_alert=Decimal("5"),
    )
    _add_product(
        db_session,
        name="ArchivedLow",
        unit="piece",
        quantity=Decimal("0"),
        min_quantity_alert=Decimal("100"),
        is_archived=True,
        is_active=False,
    )

    summary = client.get("/api/v1/products/summary", headers=headers).json()
    listing = client.get(
        "/api/v1/products",
        params={"low_stock": "true", "page_size": 100},
        headers=headers,
    ).json()

    assert summary["low_stock"] == 1
    assert [row["name"] for row in listing] == ["Low"]


def test_summary_and_list_agree_when_searching_a_category(client, db_session):
    headers = _owner_headers(client, db_session)
    _add_product(db_session, name="A", unit="g", category="cream")
    _add_product(db_session, name="B", unit="g", category="oil")

    summary = client.get(
        "/api/v1/products/summary", params={"q": "cream"}, headers=headers
    ).json()
    listing = client.get(
        "/api/v1/products", params={"q": "cream", "page_size": 100}, headers=headers
    ).json()

    assert summary["total"] == 1
    assert [row["name"] for row in listing] == ["A"]


def test_update_product_keeps_archive_state_when_flags_are_omitted(
    client, db_session
):
    """Editing a name must not silently restore an archived product.

    `ProductUpdate` carries `is_active=True` / `is_archived=False` defaults, so
    a full model dump filled them in even though the client only sent the
    fields it shows in the form.
    """
    headers = _owner_headers(client, db_session)
    product = _add_product(
        db_session,
        name="Old",
        unit="piece",
        quantity=Decimal("0"),
        is_archived=True,
        is_active=False,
    )

    resp = client.put(
        f"/api/v1/products/{product.id}",
        json={"name": "Renamed", "unit": "piece"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Renamed"
    assert body["is_archived"] is True
    assert body["is_active"] is False


def test_product_export_honours_the_tab(client, db_session):
    headers = _owner_headers(client, db_session)
    _add_product(db_session, name="ActiveOne", unit="piece")
    _add_product(
        db_session, name="ArchivedOne", unit="piece", is_archived=True, is_active=False
    )

    active = client.get(
        "/api/v1/exports/products/csv",
        params={"is_archived": "false"},
        headers=headers,
    )
    archived = client.get(
        "/api/v1/exports/products/csv",
        params={"is_archived": "true"},
        headers=headers,
    )

    assert active.status_code == 200, active.text
    assert archived.status_code == 200, archived.text
    active_text = active.content.decode("utf-8-sig")
    archived_text = archived.content.decode("utf-8-sig")
    assert "ActiveOne" in active_text
    assert "ArchivedOne" not in active_text
    assert "ArchivedOne" in archived_text
    assert "ActiveOne" not in archived_text


def test_import_products_records_the_opening_balance(client, db_session):
    """An imported quantity must leave a movement behind it.

    The archive screen derives every before/after balance from the ledger, so
    an imported quantity with no log made the ledger sum to zero against a
    shelf that did not.
    """
    import io

    import pandas as pd

    from app.models.inventory_log import InventoryLog
    from app.models.product import Product

    headers = _owner_headers(client, db_session)
    frame = pd.DataFrame(
        [
            {
                "الاسم": "Imported",
                "الكمية": 12,
                "سعر الشراء": 5,
                "سعر البيع": 9,
                "الوحدة": "قطعة",
            }
        ]
    )
    buffer = io.BytesIO()
    frame.to_csv(buffer, index=False)
    buffer.seek(0)

    resp = client.post(
        "/api/v1/imports/products",
        files={"file": ("products.csv", buffer, "text/csv")},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    product = db_session.query(Product).filter(Product.name == "Imported").one()
    assert Decimal(str(product.quantity)) == Decimal("12")
    logs = (
        db_session.query(InventoryLog)
        .filter(InventoryLog.product_id == product.id)
        .all()
    )
    assert len(logs) == 1
    assert Decimal(str(logs[0].change_amount)) == Decimal("12")


def test_insights_reports_the_shelf(client, db_session):
    from datetime import datetime

    from app.models.inventory_log import InventoryLog
    from app.models.product import Product

    headers = _owner_headers(client, db_session)

    heavy = _add_product(
        db_session,
        name="Heavy",
        category="زيوت",
        unit="g",
        quantity=Decimal("1000"),
        cost_price=Decimal("10"),
        sell_price=Decimal("20"),
        weight=Decimal("100"),
        min_quantity_alert=Decimal("0"),
    )
    low = _add_product(
        db_session,
        name="LowItem",
        category="تصفيف",
        unit="piece",
        quantity=Decimal("1"),
        cost_price=Decimal("5"),
        sell_price=Decimal("9"),
        min_quantity_alert=Decimal("4"),
    )
    _add_product(
        db_session,
        name="ArchivedHeavy",
        category="زيوت",
        unit="g",
        quantity=Decimal("10000"),
        cost_price=Decimal("10"),
        sell_price=Decimal("20"),
        weight=Decimal("100"),
        is_archived=True,
        is_active=False,
    )

    db_session.add(
        InventoryLog(
            product_id=heavy.id,
            change_amount=Decimal("-30"),
            type="remove",
            note="صرف",
            created_at=datetime.now(),
        )
    )
    db_session.commit()

    resp = client.get("/api/v1/products/insights", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # The archived heavyweight is not on the shelf.
    names = [item["name"] for item in body["top_by_value"]]
    assert "ArchivedHeavy" not in names
    assert names[0] == "Heavy"

    # Consumption is removals only and excludes archived rows.
    consumed = {item["name"]: item["consumed"] for item in body["most_consumed"]}
    assert consumed.get("Heavy") == 30

    # The low product is suggested a refill back to twice the threshold; it is
    # also the only stagnant line (it never moved) with a value on the shelf.
    low_rows = {item["id"]: item for item in body["low_stock"]}
    assert low.id in low_rows
    assert low_rows[low.id]["suggested"] == 7  # 2*4 - 1
    assert all(row["name"] != "ArchivedHeavy" for row in body["stagnant"])
    # Heavy just moved, so only LowItem is stale.
    assert {row["name"] for row in body["stagnant"]} == {"LowItem"}

    categories = {item["category"]: item for item in body["categories"]}
    assert categories["زيوت"]["count"] == 1
    assert categories["زيوت"]["cost"] == 1.0 * 100.0  # 1000g * (10/100)

    # The shelf totals only count what is on it.
    totals = body["totals"]
    assert totals["lines"] == 2  # archived row excluded
    assert totals["units"] == 1001  # 1000g + 1 piece
    assert totals["packs"] == 10  # 1000g / 100g per pack
    assert totals["missing_pack_size"] == 0
    # The response must not leak the internal pack-size field.
    assert all("weight" not in item for item in body["top_by_value"])


def test_insights_empty_database(client, db_session):
    headers = _owner_headers(client, db_session)
    resp = client.get("/api/v1/products/insights", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["top_by_value"] == []
    assert body["most_consumed"] == []
    assert body["stagnant"] == []
    assert body["categories"] == []
    assert body["low_stock"] == []
