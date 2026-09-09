from decimal import Decimal

from app.models.invoice_item import InvoiceItem
from app.models.service import Service
from tests.helpers import auth_headers, make_user
from tests.test_dashboard import _seed_customer, _seed_invoice


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def test_overview_requires_auth(client):
    resp = client.get("/api/v1/reports/overview")
    assert resp.status_code in (401, 403)


def test_overview_forbidden_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    resp = client.get("/api/v1/reports/overview", headers=auth_headers(client))
    assert resp.status_code == 403


def test_overview_empty(client, db_session):
    resp = client.get("/api/v1/reports/overview", headers=_owner_headers(client, db_session))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total_revenue"] == 0
    assert body["total_invoices"] == 0
    assert body["average_invoice"] == 0


def test_overview_aggregates_payment_methods(client, db_session):
    headers = _owner_headers(client, db_session)
    c1 = _seed_customer(db_session, phone="01004444444")
    _seed_invoice(db_session, c1.customer_id, 100, "INV-REP-001")

    c2 = _seed_customer(db_session, first_name="Laila", phone="01005555555")
    inv2 = _seed_invoice(db_session, c2.customer_id, 200, "INV-REP-002")
    inv2.payment_method = "card"
    db_session.commit()

    resp = client.get("/api/v1/reports/overview", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total_revenue"] == 300
    assert body["total_invoices"] == 2
    assert body["average_invoice"] == 150
    methods = {row["payment_method"]: row["total_amount"] for row in body["payment_methods"]}
    assert methods.get("cash") == 100
    assert methods.get("card") == 200


def test_overview_top_services_from_sold_items(client, db_session):
    headers = _owner_headers(client, db_session)
    service = Service(name="Haircut", price=Decimal("150"))
    db_session.add(service)
    db_session.commit()
    db_session.refresh(service)

    c1 = _seed_customer(db_session, phone="01006666666")
    inv = _seed_invoice(db_session, c1.customer_id, 300, "INV-REP-003")
    db_session.add(
        InvoiceItem(
            invoice_id=inv.id,
            service_id=service.id,
            service_name="Haircut",
            quantity=2,
            unit_price=Decimal("150"),
            total_price=Decimal("300"),
        )
    )
    db_session.commit()

    resp = client.get("/api/v1/reports/overview", headers=headers)
    assert resp.status_code == 200, resp.text
    top = resp.json()["top_services"]
    haircut = next((s for s in top if s["service_name"] == "Haircut"), None)
    assert haircut is not None
    assert haircut["total_revenue"] == 300
    assert haircut["sessions_count"] == 1
