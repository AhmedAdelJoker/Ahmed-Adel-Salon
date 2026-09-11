from decimal import Decimal

from app.models.business_settings import BusinessSettings
from app.models.cash_transaction import CashTransaction
from tests.helpers import auth_headers, make_user
from tests.test_dashboard import _seed_customer
from tests.test_invoice_create import _seed_barber, _seed_service


def _setup(client, db_session, phone="01002003000"):
    make_user(db_session)
    customer = _seed_customer(db_session, phone=phone)
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)
    return auth_headers(client), customer, service, barber


def _service_item(service_id, barber_id, qty=2, price=100):
    return {
        "item_type": "service",
        "service_id": service_id,
        "quantity": qty,
        "employee_id": barber_id,
        "unit_price": str(price),
    }


def test_split_invoice_creates_cash_leg(client, db_session):
    headers, customer, service, barber = _setup(client, db_session)
    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "split",
            "split_payments": [
                {"payment_method": "cash", "amount": "120"},
                {"payment_method": "card", "amount": "80"},
            ],
            "items": [_service_item(service.id, barber.id)],
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["total_amount"]) == 200

    legs = (
        db_session.query(CashTransaction)
        .filter(
            CashTransaction.reference_type == "invoice",
            CashTransaction.reference_id == body["id"],
        )
        .all()
    )
    assert len(legs) == 1
    assert float(legs[0].amount) == 120


def test_loyalty_tier_discount_applied(client, db_session):
    headers, customer, service, barber = _setup(client, db_session)
    db_session.add(
        BusinessSettings(
            salon_name="Test",
            loyalty_settings={
                "enabled": True,
                "points_per_egp": 0.1,
                "tiers": [{"name": "Gold", "min_visits": 0, "discount_percent": 10}],
            },
        )
    )
    db_session.commit()
    customer.current_tier = "Gold"
    db_session.commit()

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "card",
            "items": [_service_item(service.id, barber.id)],
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["subtotal_amount"]) == 200
    assert float(body["discount_amount"]) == 20
    assert float(body["total_amount"]) == 180


def test_loyalty_points_earned(client, db_session):
    headers, customer, service, barber = _setup(
        client, db_session, phone="01004005000"
    )
    db_session.add(
        BusinessSettings(
            salon_name="Test",
            loyalty_settings={"enabled": True, "points_per_egp": 0.1, "tiers": []},
        )
    )
    db_session.commit()

    resp = client.post(
        "/api/v1/invoices/manual",
        json={
            "customer_id": customer.customer_id,
            "payment_method": "cash",
            "items": [_service_item(service.id, barber.id, qty=1)],
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["total_amount"]) == 100

    db_session.refresh(customer)
    assert customer.visits_count == 1
    assert float(customer.lifetime_spend) == 100
    assert float(customer.loyalty_points) == 10
