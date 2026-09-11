from app.models.product import Product
from app.models.invoice import Invoice
from decimal import Decimal

from tests.helpers import auth_headers, make_user
from tests.test_dashboard import _seed_customer
from tests.test_invoice_create import _seed_barber


def test_draft_create_update_finalize_deducts_stock(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)
    _seed_customer(db_session, phone="01001001001")
    customer = _seed_customer(db_session, first_name="Laila", phone="01001001002")
    barber = _seed_barber(db_session)
    product = Product(name="Gel", quantity=Decimal("50"), sell_price=Decimal("20"))
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    created = client.post("/api/v1/invoices/drafts", headers=headers)
    assert created.status_code == 200, created.text
    draft_id = created.json()["id"]
    assert created.json()["invoice_no"].startswith("DRAFT-")
    assert db_session.query(Invoice).filter(Invoice.id == draft_id).first().is_draft is True

    updated = client.put(
        f"/api/v1/invoices/drafts/{draft_id}",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [
                {
                    "item_type": "product",
                    "product_id": product.id,
                    "quantity": 2,
                    "employee_id": barber.id,
                    "unit_price": "20",
                }
            ],
        },
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert float(updated.json()["total_amount"]) == 40

    finalized = client.post(f"/api/v1/invoices/drafts/{draft_id}/finalize", headers=headers)
    assert finalized.status_code == 200, finalized.text
    body = finalized.json()
    assert not body["invoice_no"].startswith("DRAFT-")

    db_session.refresh(product)
    assert float(product.quantity) == 48

    inv = db_session.query(Invoice).filter(Invoice.id == draft_id).first()
    assert inv.is_draft is False


def test_finalize_requires_real_customer(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)
    _seed_customer(db_session, phone="01001001003")

    created = client.post("/api/v1/invoices/drafts", headers=headers)
    assert created.status_code == 200, created.text

    resp = client.post(
        f"/api/v1/invoices/drafts/{created.json()['id']}/finalize", headers=headers
    )
    assert resp.status_code == 400
