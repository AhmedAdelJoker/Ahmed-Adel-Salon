"""Customer detail data filters + second_phone + archive delete contract.

Detail page pulls `/appointments?customer_id=` and `/invoices?customer_id=`:
these filters must actually filter instead of silently ignoring the param.
"""
from datetime import date, time
from decimal import Decimal

from app.models.customer import Customer
from app.models.employee import Employee
from app.models.appointment import Appointment
from app.models.invoice import Invoice
from app.core.clock import utc_now_naive
from tests.helpers import auth_headers, make_user


def _seed_merge_pair(db_session):
    src = Customer(
        first_name="Old",
        last_name="Entry",
        phone="01077777777",
        visits_count=3,
        lifetime_spend=Decimal("500"),
        cancellation_count=1,
    )
    tgt = Customer(
        first_name="Main",
        last_name="Customer",
        phone="01088888888",
        visits_count=2,
        lifetime_spend=Decimal("300"),
    )
    emp = Employee(
        full_name="Barber Merge",
        phone_primary="01091191191",
        job_title="barber",
    )
    db_session.add_all([src, tgt, emp])
    db_session.commit()
    db_session.refresh(src)
    db_session.refresh(tgt)
    db_session.refresh(emp)

    a_src = Appointment(
        customer_id=src.customer_id,
        barber_id=emp.id,
        appointment_date=date(2026, 2, 1),
        appointment_time=time(10, 0),
        status="completed",
        notes="src",
        total_estimated_price=Decimal("300"),
        total_estimated_duration_minutes=30,
    )
    a_tgt = Appointment(
        customer_id=tgt.customer_id,
        barber_id=emp.id,
        appointment_date=date(2026, 2, 2),
        appointment_time=time(11, 0),
        status="waiting",
        notes="tgt",
        total_estimated_price=Decimal("150"),
        total_estimated_duration_minutes=30,
    )
    inv_src = Invoice(
        invoice_no="MRG-2026-0001",
        customer_id=src.customer_id,
        payment_method="cash",
        subtotal_amount=Decimal("300"),
        total_amount=Decimal("300"),
        created_at=utc_now_naive(),
    )
    inv_tgt = Invoice(
        invoice_no="MRG-2026-0002",
        customer_id=tgt.customer_id,
        payment_method="cash",
        subtotal_amount=Decimal("150"),
        total_amount=Decimal("150"),
        created_at=utc_now_naive(),
    )
    db_session.add_all([a_src, a_tgt, inv_src, inv_tgt])
    db_session.commit()
    return src, tgt, inv_src


def test_duplicate_groups_endpoint(client, db_session):
    make_user(db_session)
    src, *_ = _seed_merge_pair(db_session)
    db_session.add(
        Customer(first_name="Twin", last_name="Two", phone=src.phone)
    )
    db_session.commit()

    headers = auth_headers(client)
    resp = client.get("/api/v1/customers/duplicates", headers=headers)
    assert resp.status_code == 200, resp.text
    groups = resp.json()["groups"]
    assert isinstance(groups, list)
    assert any(g["phone"] == src.phone for g in groups)
    group = next(g for g in groups if g["phone"] == src.phone)
    assert len(group["customers"]) == 2


def test_merge_moves_records_and_archives_source(client, db_session):
    make_user(db_session, username="ownermerge", role="owner")
    src, tgt, inv_src = _seed_merge_pair(db_session)
    headers = auth_headers(client, username="ownermerge")

    resp = client.post(
        f"/api/v1/customers/{src.customer_id}/merge",
        json={"target_customer_id": tgt.customer_id},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["customer_id"] == tgt.customer_id
    assert body["visits_count"] == 5
    assert float(body["lifetime_spend"]) == 800.0

    assert (
        db_session.query(Appointment)
        .filter(Appointment.customer_id == tgt.customer_id)
        .count()
        == 2
    )
    assert (
        db_session.query(Appointment)
        .filter(Appointment.customer_id == src.customer_id)
        .count()
        == 0
    )
    moved_invoice = (
        db_session.query(Invoice).filter(Invoice.id == inv_src.id).first()
    )
    assert moved_invoice.customer_id == tgt.customer_id

    listing = client.get("/api/v1/customers", headers=headers)
    assert all(c["customer_id"] != src.customer_id for c in listing.json())

    archive = client.get("/api/v1/customers/archive", headers=headers)
    assert any(
        a["customer_id"] == src.customer_id
        and f"#{tgt.customer_id}" in (a["archive_reason"] or "")
        for a in archive.json()
    )


def test_merge_rejects_self_and_missing(client, db_session):
    make_user(db_session, username="ownermerge2", role="owner")
    src, tgt, *_ = _seed_merge_pair(db_session)
    headers = auth_headers(client, username="ownermerge2")

    same = client.post(
        f"/api/v1/customers/{src.customer_id}/merge",
        json={"target_customer_id": src.customer_id},
        headers=headers,
    )
    assert same.status_code == 400

    missing = client.post(
        f"/api/v1/customers/{src.customer_id}/merge",
        json={"target_customer_id": 987654},
        headers=headers,
    )
    assert missing.status_code == 404



def _seed_related(db_session):
    c1 = Customer(first_name="Ali", last_name="One", phone="01011111111")
    c2 = Customer(first_name="Omar", last_name="Two", phone="01022222222")
    emp = Employee(
        full_name="Barber Filter",
        phone_primary="01099999999",
        job_title="barber",
    )
    db_session.add_all([c1, c2, emp])
    db_session.commit()
    db_session.refresh(c1)
    db_session.refresh(c2)
    db_session.refresh(emp)

    a1 = Appointment(
        customer_id=c1.customer_id,
        barber_id=emp.id,
        appointment_date=date(2026, 1, 10),
        appointment_time=time(10, 0),
        status="confirmed",
        notes="mine",
        total_estimated_price=Decimal("100"),
        total_estimated_duration_minutes=30,
    )
    a2 = Appointment(
        customer_id=c2.customer_id,
        barber_id=emp.id,
        appointment_date=date(2026, 1, 10),
        appointment_time=time(11, 0),
        status="pending",
        notes="other",
        total_estimated_price=Decimal("200"),
        total_estimated_duration_minutes=30,
    )
    inv1 = Invoice(
        invoice_no="FLT-2026-0001",
        customer_id=c1.customer_id,
        payment_method="cash",
        subtotal_amount=Decimal("100"),
        total_amount=Decimal("100"),
        created_at=utc_now_naive(),
    )
    inv2 = Invoice(
        invoice_no="FLT-2026-0002",
        customer_id=c2.customer_id,
        payment_method="cash",
        subtotal_amount=Decimal("200"),
        total_amount=Decimal("200"),
        created_at=utc_now_naive(),
    )
    db_session.add_all([a1, a2, inv1, inv2])
    db_session.commit()
    db_session.refresh(a1)
    db_session.refresh(a2)
    db_session.refresh(inv1)
    db_session.refresh(inv2)
    return c1, c2, a1, a2, inv1, inv2


def test_appointments_filter_by_customer(client, db_session):
    make_user(db_session)
    c1, _c2, a1, _a2, _i1, _i2 = _seed_related(db_session)
    headers = auth_headers(client)
    resp = client.get(
        "/api/v1/appointments",
        params={"customer_id": c1.customer_id},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["id"] == a1.id


def test_appointments_filter_customer_and_date(client, db_session):
    make_user(db_session)
    c1, _c2, a1, _a2, _i1, _i2 = _seed_related(db_session)
    headers = auth_headers(client)
    resp = client.get(
        "/api/v1/appointments",
        params={
            "customer_id": c1.customer_id,
            "date_filter": "custom",
            "start_date": "2026-01-10",
            "end_date": "2026-01-10",
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert [r["id"] for r in rows] == [a1.id]


def test_invoices_filter_by_customer(client, db_session):
    """Also guards the current-month default filter: it must not run when a
    customer_id filter narrows the query."""
    make_user(db_session)
    c1, _c2, _a1, _a2, inv1, _inv2 = _seed_related(db_session)
    headers = auth_headers(client)
    resp = client.get(
        "/api/v1/invoices",
        params={"customer_id": c1.customer_id, "limit": 50},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json().get("items", [])
    assert len(rows) == 1
    assert rows[0]["invoice_no"] == inv1.invoice_no


def test_create_customer_with_second_phone_roundtrip(client, db_session):
    make_user(db_session)
    headers = auth_headers(client)
    resp = client.post(
        "/api/v1/customers",
        json={
            "first_name": "Nada",
            "last_name": "",
            "phone": "01055500011",
            "second_phone": "01055500022",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["second_phone"] == "01055500022"

    search = client.get(
        "/api/v1/customers", params={"q": "01055500022"}, headers=headers
    )
    assert search.status_code == 200, search.text
    assert any(c["customer_id"] == body["customer_id"] for c in search.json())


def test_update_customer_rejects_duplicate_active_phone(client, db_session):
    make_user(db_session)
    c1, c2, *_ = _seed_related(db_session)
    headers = auth_headers(client)
    resp = client.put(
        f"/api/v1/customers/{c1.customer_id}",
        json={
            "first_name": "Ali",
            "last_name": "One",
            "phone": c2.phone,
        },
        headers=headers,
    )
    assert resp.status_code == 400, resp.text
    assert "مسجل بالفعل" in resp.json()["detail"]


def test_soft_delete_requires_archive_reason(client, db_session):
    make_user(db_session, username="owner2", role="owner")
    c1, *_ = _seed_related(db_session)
    headers = auth_headers(client, username="owner2")
    missing = client.delete(f"/api/v1/customers/{c1.customer_id}", headers=headers)
    assert missing.status_code == 422

    ok = client.request(
        "DELETE",
        f"/api/v1/customers/{c1.customer_id}",
        json={"archive_reason": "تكرار سبق"},
        headers=headers,
    )
    assert ok.status_code == 204, ok.text

    listing = client.get("/api/v1/customers", headers=headers)
    assert listing.status_code == 200, listing.text
    assert all(a["customer_id"] != c1.customer_id for a in listing.json())

    archive = client.get("/api/v1/customers/archive", headers=headers)
    assert archive.status_code == 200, archive.text
    assert any(
        a["customer_id"] == c1.customer_id
        and a["archive_reason"] == "تكرار سبق"
        for a in archive.json()
    )
