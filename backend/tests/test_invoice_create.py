from decimal import Decimal
from datetime import date, time

from app.models.appointment import Appointment
from app.models.cash_transaction import CashTransaction
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.product import Product
from app.models.offer import Offer
from app.models.offer_product import OfferProduct
from app.models.service import Service
from tests.helpers import auth_headers, make_user
from tests.test_dashboard import _seed_customer


def _seed_service(db_session, price=100):
    service = Service(name="Cut", price=Decimal(str(price)), duration_minutes=30)
    db_session.add(service)
    db_session.commit()
    db_session.refresh(service)
    return service


def _seed_barber(db_session):
    barber = Employee(full_name="Barber One", phone_primary="01009998888", job_title="barber")
    db_session.add(barber)
    db_session.commit()
    db_session.refresh(barber)
    return barber


def _item(service_id, barber_id, qty=2, price=100):
    return {
        "item_type": "service",
        "service_id": service_id,
        "quantity": qty,
        "employee_id": barber_id,
        "unit_price": str(price),
    }


def test_universal_search_uses_current_product_and_invoice_fields(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    product = Product(
        name="Hair Serum",
        quantity=Decimal("10"),
        sell_price=Decimal("75"),
    )
    db_session.add(product)
    db_session.commit()

    response = client.get(
        "/api/v1/search/universal",
        params={"q": "Hair"},
        headers=auth_headers(client, username="owner1"),
    )

    assert response.status_code == 200, response.text
    product_result = next(item for item in response.json() if item["type"] == "product")
    assert "75" in product_result["sub"]


def test_create_cash_invoice(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01001112222")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["invoice_no"]
    assert float(body["subtotal_amount"]) == 200
    assert float(body["total_amount"]) == 200
    assert body["barber_id"] == barber.id
    assert len(body["items"]) == 1
    assert body["items"][0]["service_name"] == "Cut"

    db_session.refresh(customer)
    assert customer.visits_count == 1
    assert float(customer.lifetime_spend) == 200


def test_create_invoice_with_discount(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01003334444")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "card",
            "discount_amount": "30",
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["subtotal_amount"]) == 200
    assert float(body["discount_amount"]) == 30
    assert float(body["total_amount"]) == 170


def test_create_invoice_walkin_fallback(client, db_session):
    make_user(db_session)
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_name": "أحمد محمد علي",
            "payment_method": "cash",
            "items": [_item(service.id, barber.id, qty=1)],
        },
        headers=auth_headers(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["total_amount"]) == 100
    walkin = db_session.query(Customer).filter(Customer.first_name == "Walk-in").first()
    assert walkin is not None
    assert body["customer_id"] == walkin.customer_id
    # The guest name is printed from the snapshot, not from the shared
    # Walk-in row.
    assert body["customer_name"] == "أحمد محمد علي"
    assert body["customer_name_snapshot"] == "أحمد محمد علي"


def test_manual_invoice_requires_three_part_name_for_new_customer(client, db_session):
    make_user(db_session)
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)
    headers = auth_headers(client)

    missing = client.post(
        "/api/v1/invoices/manual",
        json={
            "payment_method": "cash",
            "items": [_item(service.id, barber.id)],
        },
        headers=headers,
    )
    assert missing.status_code == 422, missing.text

    two_parts = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_name": "أحمد محمد",
            "customer_phone": "01012345678",
            "payment_method": "cash",
            "items": [_item(service.id, barber.id)],
        },
        headers=headers,
    )
    assert two_parts.status_code == 422, two_parts.text
    assert db_session.query(Customer).filter(Customer.phone == "01012345678").count() == 0


def test_manual_invoice_creates_customer_from_three_part_name_and_phone(
    client, db_session
):
    make_user(db_session)
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_name": "منى سعيد حسن",
            "customer_phone": "01098765432",
            "payment_method": "cash",
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    created = (
        db_session.query(Customer)
        .filter(Customer.phone == "01098765432")
        .one()
    )
    assert created.first_name == "منى"
    assert created.last_name == "سعيد حسن"
    assert body["customer_id"] == created.customer_id
    assert body["customer_name_snapshot"] == "منى سعيد حسن"


def test_manual_invoice_existing_phone_keeps_the_same_customer(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01011112222")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_name": "اسم مختلف تماماً",
            "customer_phone": "01011112222",
            "payment_method": "cash",
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["customer_id"] == customer.customer_id
    assert body["customer_name_snapshot"] == "اسم مختلف تماماً"
    assert (
        db_session.query(Customer).filter(Customer.phone == "01011112222").count() == 1
    )


def test_manual_invoice_normalizes_formatted_phone_before_matching(
    client, db_session
):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01011112222")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_name": "اسم مختلف تماماً",
            "customer_phone": "010 1111 2222",
            "payment_method": "cash",
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["customer_id"] == customer.customer_id
    assert db_session.query(Customer).filter(Customer.phone == "01011112222").count() == 1


def test_manual_invoice_stores_new_customer_phone_as_digits(client, db_session):
    make_user(db_session)
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_name": "هدى محمد كمال",
            "customer_phone": "010-9876-5432",
            "payment_method": "cash",
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )

    assert resp.status_code == 200, resp.text
    created = db_session.query(Customer).filter(Customer.phone == "01098765432").one()
    assert resp.json()["customer_id"] == created.customer_id


def test_manual_invoice_appointment_customer_does_not_need_three_part_name(
    client, db_session
):
    make_user(db_session)
    customer = _seed_customer(db_session, first_name="Sara", phone="01033334444")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)
    appointment = Appointment(
        customer_id=customer.customer_id,
        barber_id=barber.id,
        appointment_date=date.today(),
        appointment_time=time(12, 0),
        status="ready_for_payment",
    )
    db_session.add(appointment)
    db_session.commit()
    db_session.refresh(appointment)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_name": "Sara Ali",
            "appointment_id": appointment.id,
            "payment_method": "cash",
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["customer_id"] == customer.customer_id
    assert resp.json()["customer_name_snapshot"] == "Sara Ali"


def test_create_invoice_deducts_product_stock(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01005556666")
    barber = _seed_barber(db_session)
    product = Product(name="Shampoo", quantity=Decimal("100"), sell_price=Decimal("50"))
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [
                {
                    "item_type": "product",
                    "product_id": product.id,
                    "quantity": 2,
                    "employee_id": barber.id,
                    "unit_price": "50",
                }
            ],
        },
        headers=auth_headers(client),
    )
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["total_amount"]) == 100

    db_session.refresh(product)
    assert float(product.quantity) == 98


def test_create_invoice_requires_auth(client):
    resp = client.post(
        "/api/v1/invoices/manual",
        json={"payment_method": "cash", "items": []},
    )
    assert resp.status_code in (401, 403)


def test_manual_invoice_uses_catalog_price(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01007778888")
    service = _seed_service(db_session, price=100)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [_item(service.id, barber.id, price=1)],
        },
        headers=auth_headers(client),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["total_amount"]) == 200
    assert float(body["items"][0]["unit_price"]) == 100


def test_manual_invoice_idempotency_replays_same_invoice(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01005551111")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)
    headers = auth_headers(client)
    headers["Idempotency-Key"] = "invoice-test-001"
    payload = {
        "customer_id": customer.customer_id,
        "payment_method": "cash",
        "items": [_item(service.id, barber.id)],
    }

    first = client.post("/api/v1/invoices/manual", json=payload, headers=headers)
    second = client.post("/api/v1/invoices/manual", json=payload, headers=headers)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert first.json()["id"] == second.json()["id"]
    assert db_session.query(Invoice).count() == 1
    assert (
        db_session.query(CashTransaction)
        .filter(CashTransaction.reference_id == first.json()["id"])
        .count()
        == 1
    )


def test_manual_offer_uses_offer_price_and_deducts_products(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01006667777")
    barber = _seed_barber(db_session)
    product = Product(name="Offer Product", quantity=Decimal("10"), sell_price=Decimal("50"))
    offer = Offer(name="Combo", offer_price=Decimal("70"), is_active=True)
    db_session.add_all([product, offer])
    db_session.flush()
    db_session.add(OfferProduct(offer_id=offer.id, product_id=product.id, quantity=2))
    db_session.commit()
    db_session.refresh(product)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [
                {
                    "item_type": "offer",
                    "offer_id": offer.id,
                    "quantity": 1,
                    "employee_id": barber.id,
                    "unit_price": "1",
                }
            ],
        },
        headers=auth_headers(client),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["total_amount"]) == 70
    assert body["items"][0]["offer_id"] == offer.id
    db_session.refresh(product)
    assert float(product.quantity) == 8


def test_manual_product_offer_without_employee_is_allowed(client, db_session):
    """A product-only offer is retail stock: no performer, no commission.

    The POS sends `employee_id: null` for these lines. The invoice must still
    issue normally and deduct every bundled product from inventory.
    """
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01006667778")
    product = Product(
        name="Offer Shampoo", quantity=Decimal("6"), sell_price=Decimal("40")
    )
    offer = Offer(name="Shampoo Duo", offer_price=Decimal("65"), is_active=True)
    db_session.add_all([product, offer])
    db_session.flush()
    db_session.add(OfferProduct(offer_id=offer.id, product_id=product.id, quantity=2))
    db_session.commit()
    db_session.refresh(product)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [
                {
                    "item_type": "offer",
                    "offer_id": offer.id,
                    "quantity": 2,
                    "employee_id": None,
                    "unit_price": "1",
                }
            ],
        },
        headers=auth_headers(client),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["total_amount"]) == 130
    assert body["items"][0]["offer_id"] == offer.id
    assert body["items"][0]["employee_id"] is None
    assert float(body["items"][0]["commission_amount"]) == 0
    db_session.refresh(product)
    # Two bundles × two units each.
    assert float(product.quantity) == 2


def test_manual_invoice_rejects_non_positive_quantity(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01008889999")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [_item(service.id, barber.id, qty=0)],
        },
        headers=auth_headers(client),
    )

    assert resp.status_code == 422


def test_manual_invoice_rejects_excess_discount(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01009990000")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "discount_amount": "250",
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )

    assert resp.status_code == 400


def test_split_invoice_rejects_mismatched_total(client, db_session):
    make_user(db_session)
    customer = _seed_customer(db_session, phone="01001110000")
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "split",
            "split_payments": [
                {"payment_method": "cash", "amount": "100"},
                {"payment_method": "card", "amount": "50"},
            ],
            "items": [_item(service.id, barber.id)],
        },
        headers=auth_headers(client),
    )

    assert resp.status_code == 400
