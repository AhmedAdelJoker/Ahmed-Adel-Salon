from decimal import Decimal
from datetime import date, timedelta

from app.models.customer import Customer
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from tests.helpers import auth_headers, make_user


def _owner_headers(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, username="owner1")


def _seed_employee(db_session, name="Ahmed Barber", status="active"):
    emp = Employee(
        full_name=name,
        phone_primary="01000000000",
        job_title="barber",
        status=status,
        is_active=(status == "active"),
    )
    db_session.add(emp)
    db_session.commit()
    db_session.refresh(emp)
    return emp


def _seed_customer(db_session, phone="01001234567"):
    customer = Customer(
        first_name="Sara",
        last_name="Test",
        phone=phone,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


def _seed_invoice_with_item(
    db_session,
    barber_id,
    customer_id,
    total=100,
    invoice_no="INV-PERF-001",
    service_name="Haircut",
    is_draft=False,
):
    invoice = Invoice(
        invoice_no=invoice_no,
        customer_id=customer_id,
        barber_id=barber_id,
        payment_method="cash",
        subtotal_amount=Decimal(str(total)),
        total_amount=Decimal(str(total)),
        is_draft=is_draft,
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)

    item = InvoiceItem(
        invoice_id=invoice.id,
        service_name=service_name,
        quantity=1,
        unit_price=Decimal(str(total)),
        total_price=Decimal(str(total)),
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return invoice, item


def _date_range():
    """Return (from_date, to_date) strings covering today."""
    today = date.today()
    return today.isoformat(), today.isoformat()


def test_employee_performance_requires_auth(client):
    from_date, to_date = _date_range()
    resp = client.get(
        "/api/v1/reports/employee-performance",
        params={"from_date": from_date, "to_date": to_date},
    )
    assert resp.status_code in (401, 403)


def test_employee_performance_forbidden_for_cashier(client, db_session):
    make_user(db_session, role="cashier")
    from_date, to_date = _date_range()
    resp = client.get(
        "/api/v1/reports/employee-performance",
        params={"from_date": from_date, "to_date": to_date},
        headers=auth_headers(client),
    )
    assert resp.status_code == 403


def test_employee_performance_empty(client, db_session):
    headers = _owner_headers(client, db_session)
    from_date, to_date = _date_range()
    resp = client.get(
        "/api/v1/reports/employee-performance",
        params={"from_date": from_date, "to_date": to_date},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["summary"]["total_sales"] == 0
    assert body["summary"]["employee_count"] == 0


def test_employee_performance_aggregates(client, db_session):
    headers = _owner_headers(client, db_session)
    emp = _seed_employee(db_session, name="Ahmed")
    customer = _seed_customer(db_session)

    _seed_invoice_with_item(db_session, emp.id, customer.customer_id, 100, "INV-P1", "Haircut")
    _seed_invoice_with_item(db_session, emp.id, customer.customer_id, 200, "INV-P2", "Shave")

    from_date, to_date = _date_range()
    resp = client.get(
        "/api/v1/reports/employee-performance",
        params={"from_date": from_date, "to_date": to_date},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["employee_name"] == "Ahmed"
    assert item["sales"] == 300
    assert item["service_count"] == 2
    assert item["invoice_count"] == 2
    assert item["avg_ticket"] == 150
    assert body["summary"]["total_sales"] == 300
    assert body["summary"]["employee_count"] == 1


def test_employee_performance_excludes_drafts(client, db_session):
    headers = _owner_headers(client, db_session)
    emp = _seed_employee(db_session)
    customer = _seed_customer(db_session)

    _seed_invoice_with_item(db_session, emp.id, customer.customer_id, 100, "INV-NORMAL")
    _seed_invoice_with_item(db_session, emp.id, customer.customer_id, 9000, "INV-DRAFT", is_draft=True)

    from_date, to_date = _date_range()
    resp = client.get(
        "/api/v1/reports/employee-performance",
        params={"from_date": from_date, "to_date": to_date},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["sales"] == 100
    assert body["summary"]["total_sales"] == 100


def test_employee_performance_search(client, db_session):
    headers = _owner_headers(client, db_session)
    emp1 = _seed_employee(db_session, name="Ahmed Ali")
    emp2 = _seed_employee(db_session, name="Sara Mohamed")
    customer = _seed_customer(db_session)

    _seed_invoice_with_item(db_session, emp1.id, customer.customer_id, 100, "INV-S1")
    _seed_invoice_with_item(db_session, emp2.id, customer.customer_id, 200, "INV-S2")

    from_date, to_date = _date_range()
    resp = client.get(
        "/api/v1/reports/employee-performance",
        params={"from_date": from_date, "to_date": to_date, "search": "Ahmed"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["employee_name"] == "Ahmed Ali"


def test_employee_performance_pagination(client, db_session):
    headers = _owner_headers(client, db_session)
    customer = _seed_customer(db_session)

    for i in range(5):
        emp = _seed_employee(db_session, name=f"Emp {i}")
        _seed_invoice_with_item(
            db_session,
            emp.id,
            customer.customer_id,
            total=100 * (i + 1),
            invoice_no=f"INV-PAG-{i}",
        )

    from_date, to_date = _date_range()
    resp = client.get(
        "/api/v1/reports/employee-performance",
        params={"from_date": from_date, "to_date": to_date, "page": 1, "page_size": 2},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["page"] == 1
    assert body["page_size"] == 2


def test_employee_performance_top_service(client, db_session):
    headers = _owner_headers(client, db_session)
    emp = _seed_employee(db_session, name="Barber One")
    customer = _seed_customer(db_session)

    _seed_invoice_with_item(db_session, emp.id, customer.customer_id, 100, "INV-TS1", "Haircut")
    _seed_invoice_with_item(db_session, emp.id, customer.customer_id, 100, "INV-TS2", "Haircut")
    _seed_invoice_with_item(db_session, emp.id, customer.customer_id, 50, "INV-TS3", "Shave")

    from_date, to_date = _date_range()
    resp = client.get(
        "/api/v1/reports/employee-performance",
        params={"from_date": from_date, "to_date": to_date},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["items"][0]["top_service_name"] == "Haircut"
    assert body["items"][0]["service_count"] == 3
