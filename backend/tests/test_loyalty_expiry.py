from datetime import datetime, timedelta

from app.models.business_settings import BusinessSettings
from tests.helpers import auth_headers, make_user
from tests.test_dashboard import _seed_customer
from tests.test_invoice_create import _seed_barber, _seed_service


def _setup(client, db_session, phone="01555667788"):
    make_user(db_session)
    customer = _seed_customer(db_session, phone=phone)
    service = _seed_service(db_session)
    barber = _seed_barber(db_session)
    return auth_headers(client), customer, service, barber


def _enable_expiry(db_session, months=1):
    db_session.add(
        BusinessSettings(
            salon_name="Test",
            loyalty_settings={
                "enabled": True,
                "points_per_egp": 0.1,
                "points_expiry_months": months,
                "tiers": [],
            },
        )
    )
    db_session.commit()


def _service_item(service_id, barber_id, qty=1, price=100):
    return {
        "item_type": "service",
        "service_id": service_id,
        "quantity": qty,
        "employee_id": barber_id,
        "unit_price": str(price),
    }


def _invoice_payload(customer, service, barber):
    return {
        "customer_id": customer.customer_id,
        "payment_method": "cash",
        "items": [_service_item(service.id, barber.id)],
    }


def test_expired_balance_swept_then_fresh_points_earned(client, db_session):
    headers, customer, service, barber = _setup(client, db_session)
    _enable_expiry(db_session, months=1)
    customer.loyalty_points = 50
    customer.loyalty_points_earned_at = datetime.utcnow() - timedelta(days=45)
    db_session.commit()

    resp = client.post(
        "/api/v1/invoices/manual",
        json=_invoice_payload(customer, service, barber),
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    db_session.refresh(customer)
    # الرصيد المنتهي (50) صُفّر ثم أُضيف كسب الفاتورة الجديدة 100 * 0.1 = 10
    assert float(customer.loyalty_points) == 10
    assert customer.loyalty_points_earned_at is not None


def test_fresh_balance_survives_next_invoice(client, db_session):
    headers, customer, service, barber = _setup(
        client, db_session, phone="01555667799"
    )
    _enable_expiry(db_session, months=1)
    customer.loyalty_points = 50
    customer.loyalty_points_earned_at = datetime.utcnow() - timedelta(days=5)
    db_session.commit()

    resp = client.post(
        "/api/v1/invoices/manual",
        json=_invoice_payload(customer, service, barber),
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    db_session.refresh(customer)
    # الرصيد ما زال داخل فترة الصلاحية: 50 + 10 = 60
    assert float(customer.loyalty_points) == 60


def test_expired_balance_zeroed_on_customer_read(client, db_session):
    headers, customer, *_ = _setup(client, db_session, phone="01555667711")
    _enable_expiry(db_session, months=1)
    customer.loyalty_points = 50
    customer.loyalty_points_earned_at = datetime.utcnow() - timedelta(days=45)
    db_session.commit()

    resp = client.get(
        f"/api/v1/customers/{customer.customer_id}", headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["loyalty_points"]) == 0


def test_no_expiry_keeps_old_balance_on_read(client, db_session):
    headers, customer, *_ = _setup(client, db_session, phone="01555667722")
    db_session.add(
        BusinessSettings(
            salon_name="Test",
            loyalty_settings={
                "enabled": True,
                "points_per_egp": 0.1,
                "points_expiry_months": 0,
                "tiers": [],
            },
        )
    )
    db_session.commit()
    customer.loyalty_points = 50
    customer.loyalty_points_earned_at = datetime.utcnow() - timedelta(days=400)
    db_session.commit()

    resp = client.get(
        f"/api/v1/customers/{customer.customer_id}", headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["loyalty_points"]) == 50
