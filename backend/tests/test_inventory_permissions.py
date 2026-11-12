"""Inventory stock-outstanding permission rules.

Front-desk staff (cashier, accountant) can list and receive stock, but once a
product carries stock only management (owner, admin, manager) may edit it,
change its price, or move its count. Expense creation from a stock-in always
requires management — a cashier can never book a supplier expense or a cashbox
movement on the salon's behalf.
"""

from decimal import Decimal

from tests.helpers import auth_headers, make_user
from tests.test_payroll_flow import _seed_barber  # noqa: F401  (fixture helper reused)

from app.models.product import Product


def _seed_product(db_session, *, quantity=0, cost_price="100.00", sell_price="200.00", name="Test Product"):
    product = Product(
        name=name,
        quantity=Decimal(str(quantity)),
        unit="قطعة",
        cost_price=Decimal(cost_price),
        sell_price=Decimal(sell_price),
        min_quantity_alert=1,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def test_cashier_can_create_unstocked_product_and_edit_it(client, db_session):
    make_user(db_session, username="cashier-inv", role="cashier")
    headers = auth_headers(client, username="cashier-inv", password="Cashier123")

    create = client.post(
        "/api/v1/products",
        json={"name": "New Item", "unit": "g", "cost_price": "10", "sell_price": "25", "min_quantity_alert": 2},
        headers=headers,
    )
    assert create.status_code == 201, create.text
    pid = create.json()["id"]

    # Quantity is 0 — no stock yet, so the cashier may still edit.
    edit = client.put(
        f"/api/v1/products/{pid}",
        json={"name": "New Item Renamed", "sell_price": "30"},
        headers=headers,
    )
    assert edit.status_code == 200, edit.text
    assert edit.json()["name"] == "New Item Renamed"


def test_cashier_cannot_edit_stocked_product(client, db_session):
    make_user(db_session, username="cashier-locked", role="cashier")
    product = _seed_product(db_session, quantity=10)
    headers = auth_headers(client, username="cashier-locked", password="Cashier123")

    resp = client.put(
        f"/api/v1/products/{product.id}",
        json={"name": "Hacked Name", "sell_price": "999"},
        headers=headers,
    )
    assert resp.status_code == 403
    assert isinstance(resp.json().get("detail"), str)

    prices = client.patch(
        f"/api/v1/products/{product.id}/update-prices",
        params={"sell_price": "999"},
        headers=headers,
    )
    assert prices.status_code == 403


def test_manager_can_edit_stocked_product(client, db_session):
    make_user(db_session, username="manager-inv", role="manager")
    product = _seed_product(db_session, quantity=10)
    headers = auth_headers(client, username="manager-inv", password="Cashier123")

    resp = client.put(
        f"/api/v1/products/{product.id}",
        json={"name": "Manager Edit", "sell_price": "250"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["sell_price"]) == 250.0


def test_cashier_cannot_create_expense_via_add_stock(client, db_session):
    make_user(db_session, username="cashier-expense", role="cashier")
    product = _seed_product(db_session, quantity=0, cost_price="50.00")
    headers = auth_headers(client, username="cashier-expense", password="Cashier123")

    resp = client.post(
        f"/api/v1/products/{product.id}/add-stock",
        json={"amount": 2, "create_expense": True, "purchase_price": 50},
        headers=headers,
    )
    assert resp.status_code == 403

    plain = client.post(
        f"/api/v1/products/{product.id}/add-stock",
        json={"amount": 2, "create_expense": False},
        headers=headers,
    )
    assert plain.status_code == 201 or plain.status_code == 200, plain.text


def test_cashier_cannot_adjust_stock_or_remove_stock(client, db_session):
    make_user(db_session, username="cashier-remove", role="cashier")
    product = _seed_product(db_session, quantity=10)
    headers = auth_headers(client, username="cashier-remove", password="Cashier123")

    remove = client.post(
        f"/api/v1/products/{product.id}/remove-stock",
        json={"amount": 1},
        headers=headers,
    )
    assert remove.status_code == 403

    adjust = client.post(
        f"/api/v1/products/{product.id}/adjust-stock",
        json={"amount": 999},
        headers=headers,
    )
    assert adjust.status_code == 403


def test_low_stock_filter_returns_only_low_items(client, db_session):
    make_user(db_session, username="manager-filter", role="manager")
    low = _seed_product(db_session, quantity=1, name="Low Item")
    ok = _seed_product(db_session, quantity=50, name="Plenty Item")
    headers = auth_headers(client, username="manager-filter", password="Cashier123")

    resp = client.get("/api/v1/products?low_stock=true", headers=headers)
    assert resp.status_code == 200, resp.text
    names = {p["name"] for p in resp.json()}
    assert "Low Item" in names
    assert "Plenty Item" not in names
    # Legacy call still returns everything.
    all_resp = client.get("/api/v1/products", headers=headers)
    assert len(all_resp.json()) >= 2


def test_accountant_is_read_mostly_but_can_receive_stock(client, db_session):
    make_user(db_session, username="accountant-inv", role="accountant")
    product = _seed_product(db_session, quantity=0)
    headers = auth_headers(client, username="accountant-inv", password="Cashier123")

    view = client.get("/api/v1/products", headers=headers)
    assert view.status_code == 200

    supply = client.post(
        f"/api/v1/products/{product.id}/add-stock",
        json={"amount": 3, "create_expense": False},
        headers=headers,
    )
    assert supply.status_code in (200, 201), supply.text

    adjust = client.post(
        f"/api/v1/products/{product.id}/adjust-stock",
        json={"amount": 1000},
        headers=headers,
    )
    assert adjust.status_code == 403
