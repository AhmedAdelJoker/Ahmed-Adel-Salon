from datetime import date, timedelta
from decimal import Decimal

from app.models.inventory_log import InventoryLog
from app.models.product import Product
from tests.helpers import auth_headers, make_user


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def _seed_product(db_session, name="Shampoo", category="Care"):
    product = Product(name=name, category=category, unit="ml")
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def _seed_log(db_session, product_id, change, log_type="add", note="توريد", log_no=None):
    log = InventoryLog(
        product_id=product_id,
        change_amount=Decimal(str(change)),
        type=log_type,
        note=f"{note} {log_no}" if log_no is not None else note,
    )
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)
    return log


def test_inventory_logs_requires_auth(client):
    resp = client.get("/api/v1/products/logs/all")
    assert resp.status_code in (401, 403)


def test_inventory_logs_forbidden_for_barber(client, db_session):
    make_user(db_session, username="barber1", role="barber")
    resp = client.get(
        "/api/v1/products/logs/all",
        headers=auth_headers(client, username="barber1"),
    )
    assert resp.status_code == 403


def test_inventory_logs_allowed_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.get(
        "/api/v1/products/logs/all", headers=auth_headers(client)
    )
    assert resp.status_code == 200, resp.text


def test_inventory_logs_empty(client, db_session):
    headers = _owner_headers(client, db_session)
    resp = client.get("/api/v1/products/logs/all", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["page"] == 1
    assert body["page_size"] == 25
    assert body["summary"]["total"] == 0
    assert body["summary"]["adds"] == 0
    assert body["summary"]["removes"] == 0


def test_inventory_logs_summary_and_product_name(client, db_session):
    headers = _owner_headers(client, db_session)
    product = _seed_product(db_session, name="Shampoo Pro")
    _seed_log(db_session, product.id, 100, "add", "توريد", 1)
    _seed_log(db_session, product.id, -30, "remove", "صرف", 2)

    resp = client.get("/api/v1/products/logs/all", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 2
    assert body["summary"]["adds"] == 1
    assert body["summary"]["removes"] == 1
    assert float(body["summary"]["net"]) == 70
    names = {item["product_name"] for item in body["items"]}
    assert names == {"Shampoo Pro"}
    # newest first
    assert float(body["items"][0]["change_amount"]) == -30


def test_inventory_logs_type_filter(client, db_session):
    headers = _owner_headers(client, db_session)
    product = _seed_product(db_session)
    _seed_log(db_session, product.id, 100, "add", "توريد", 1)
    _seed_log(db_session, product.id, -30, "remove", "صرف", 2)

    resp = client.get(
        "/api/v1/products/logs/all", params={"type": "add"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["type"] == "add"


def test_inventory_logs_search_note_and_product(client, db_session):
    headers = _owner_headers(client, db_session)
    p1 = _seed_product(db_session, name="Shampoo")
    p2 = _seed_product(db_session, name="Conditioner")
    _seed_log(db_session, p1.id, 50, "add", "توريد شحنة", 1)
    _seed_log(db_session, p2.id, 20, "add", "توريد شحنة", 2)

    resp = client.get(
        "/api/v1/products/logs/all", params={"q": "Shampoo"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["product_id"] == p1.id


def test_inventory_logs_pagination(client, db_session):
    headers = _owner_headers(client, db_session)
    product = _seed_product(db_session)
    for i in range(5):
        _seed_log(db_session, product.id, 10, "add", "توريد", i)

    resp = client.get(
        "/api/v1/products/logs/all",
        params={"page": 1, "page_size": 2},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["page"] == 1
    assert body["page_size"] == 2

    resp = client.get(
        "/api/v1/products/logs/all",
        params={"page": 3, "page_size": 2},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["items"]) == 1


def test_inventory_logs_date_filter(client, db_session):
    headers = _owner_headers(client, db_session)
    product = _seed_product(db_session)
    _seed_log(db_session, product.id, 10, "add", "توريد", 1)

    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    resp = client.get(
        "/api/v1/products/logs/all",
        params={"from_date": today, "to_date": today},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1

    resp = client.get(
        "/api/v1/products/logs/all",
        params={"from_date": tomorrow},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 0

    resp = client.get(
        "/api/v1/products/logs/all",
        params={"to_date": yesterday},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 0


def test_inventory_logs_invalid_date(client, db_session):
    headers = _owner_headers(client, db_session)
    resp = client.get(
        "/api/v1/products/logs/all",
        params={"from_date": "not-a-date"},
        headers=headers,
    )
    assert resp.status_code == 400
