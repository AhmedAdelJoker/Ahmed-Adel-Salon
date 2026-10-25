from datetime import datetime
from decimal import Decimal

from app.core.clock import salon_now
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.month_closure import MonthClosure
from tests.helpers import auth_headers, make_user
from tests.test_dashboard import _seed_customer


def _month_parts(offset: int) -> tuple[int, int]:
    now = salon_now()
    total = now.year * 12 + (now.month - 1) + offset
    year, month_index = divmod(total, 12)
    return year, month_index + 1


def _month_key(offset: int) -> str:
    year, month = _month_parts(offset)
    return f"{year:04d}-{month:02d}"


def _seed_invoice(
    db_session,
    customer_id,
    total,
    invoice_no,
    offset,
    is_draft=False,
    is_closed=False,
):
    year, month = _month_parts(offset)
    invoice = Invoice(
        invoice_no=invoice_no,
        customer_id=customer_id,
        payment_method="cash",
        subtotal_amount=Decimal(str(total)),
        total_amount=Decimal(str(total)),
        is_draft=is_draft,
        is_closed=is_closed,
        closed_at=datetime(year, month, 15, 12) if is_closed else None,
        created_at=datetime(year, month, 15, 12),
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)
    return invoice


def _seed_item(db_session, invoice, name="خدمة", price=100):
    item = InvoiceItem(
        invoice_id=invoice.id,
        service_name=name,
        quantity=1,
        unit_price=Decimal(str(price)),
        total_price=Decimal(str(price)),
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


def test_archive_excludes_drafts_and_uses_previous_calendar_month(client, db_session):
    make_user(db_session, username="archive_admin", role="admin")
    headers = auth_headers(client, username="archive_admin")
    customer = _seed_customer(db_session, phone="01004000001")

    _seed_invoice(db_session, customer.customer_id, 300, "INV-AR-OLD", -3)
    _seed_invoice(db_session, customer.customer_id, 450, "INV-AR-NEW", -2)
    _seed_invoice(
        db_session,
        customer.customer_id,
        999,
        "INV-AR-DRAFT",
        -2,
        is_draft=True,
    )

    resp = client.get("/api/v1/invoices/archive/monthly", headers=headers)
    assert resp.status_code == 200, resp.text
    months = {row["key"]: row for row in resp.json()}
    latest = months[_month_key(-2)]
    previous = months[_month_key(-3)]

    assert latest["invoice_count"] == 1
    assert latest["draft_count"] == 1
    assert latest["paid_count"] == 1
    assert latest["total_amount"] == 450.0
    assert latest["change_percent"] == 50.0
    assert latest["status"] == "open"
    assert latest["is_locked"] is False
    assert latest["voided_count"] == 0
    assert previous["change_percent"] is None


def test_month_lock_is_separate_from_voided_invoices(client, db_session):
    """قفل الشهر لا يمس حالة الفاتورة الملغاة، وفتحه لا يفتحها."""
    make_user(db_session, username="archive_admin", role="admin")
    headers = auth_headers(client, username="archive_admin")
    customer = _seed_customer(db_session, phone="01004000002")
    open_invoice = _seed_invoice(
        db_session,
        customer.customer_id,
        100,
        "INV-AR-A",
        -2,
    )
    voided_invoice = _seed_invoice(
        db_session,
        customer.customer_id,
        200,
        "INV-AR-B",
        -2,
        is_closed=True,
    )

    resp = client.get("/api/v1/invoices/archive/monthly", headers=headers)
    month = next(row for row in resp.json() if row["key"] == _month_key(-2))
    assert month["status"] == "partial"
    assert month["is_locked"] is False
    assert month["voided_count"] == 1

    closed = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/close",
        headers=headers,
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["is_locked"] is True

    db_session.refresh(open_invoice)
    db_session.refresh(voided_invoice)
    assert open_invoice.is_closed is False
    assert voided_invoice.is_closed is True
    assert db_session.query(MonthClosure).count() == 1

    resp = client.get("/api/v1/invoices/archive/monthly", headers=headers)
    month = next(row for row in resp.json() if row["key"] == _month_key(-2))
    assert month["status"] == "locked"
    assert month["is_locked"] is True
    assert month["locked_at"] is not None
    assert month["voided_count"] == 1

    again = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/close",
        headers=headers,
    )
    assert again.status_code == 400, again.text

    reopened = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/reopen",
        headers=headers,
    )
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["is_locked"] is False
    assert db_session.query(MonthClosure).count() == 0

    db_session.refresh(voided_invoice)
    assert voided_invoice.is_closed is True

    resp = client.get("/api/v1/invoices/archive/monthly", headers=headers)
    month = next(row for row in resp.json() if row["key"] == _month_key(-2))
    assert month["status"] == "partial"
    assert month["is_locked"] is False
    assert month["voided_count"] == 1

    not_locked = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/reopen",
        headers=headers,
    )
    assert not_locked.status_code == 400, not_locked.text


def test_close_month_rejects_drafts_and_leaves_final_invoices_open(client, db_session):
    make_user(db_session, username="archive_admin", role="admin")
    headers = auth_headers(client, username="archive_admin")
    customer = _seed_customer(db_session, phone="01004000003")
    final = _seed_invoice(db_session, customer.customer_id, 100, "INV-AR-FINAL", -2)
    draft = _seed_invoice(
        db_session,
        customer.customer_id,
        500,
        "INV-AR-DRAFT-2",
        -2,
        is_draft=True,
    )

    resp = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/close",
        headers=headers,
    )
    assert resp.status_code == 400, resp.text
    assert "مسودات" in resp.json()["detail"]
    assert db_session.query(MonthClosure).count() == 0

    db_session.refresh(final)
    db_session.refresh(draft)
    assert final.is_closed is False
    assert draft.is_draft is True
    assert draft.is_closed is False


def test_close_month_requires_manager_role(client, db_session):
    make_user(db_session, username="archive_cashier", role="cashier")
    make_user(db_session, username="archive_manager", role="manager")
    customer = _seed_customer(db_session, phone="01004000004")
    _seed_invoice(db_session, customer.customer_id, 100, "INV-AR-ROLE", -2)

    cashier_headers = auth_headers(client, username="archive_cashier")
    manager_headers = auth_headers(client, username="archive_manager")

    denied = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/close",
        headers=cashier_headers,
    )
    assert denied.status_code == 403
    allowed = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/close",
        headers=manager_headers,
    )
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["is_locked"] is True


def test_current_month_is_not_part_of_the_archive(client, db_session):
    make_user(db_session, username="archive_admin", role="admin")
    headers = auth_headers(client, username="archive_admin")
    customer = _seed_customer(db_session, phone="01004000005")
    _seed_invoice(db_session, customer.customer_id, 100, "INV-AR-CURRENT", 0)

    resp = client.get("/api/v1/invoices/archive/monthly", headers=headers)
    assert resp.status_code == 200, resp.text
    assert _month_key(0) not in {row["key"] for row in resp.json()}


def test_locked_month_blocks_invoice_adjustment_requests(client, db_session):
    make_user(db_session, username="archive_admin", role="admin")
    headers = auth_headers(client, username="archive_admin")
    customer = _seed_customer(db_session, phone="01004000006")
    invoice = _seed_invoice(db_session, customer.customer_id, 100, "INV-AR-ADJ", -2)

    locked = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/close",
        headers=headers,
    )
    assert locked.status_code == 200, locked.text

    denied = client.post(
        f"/api/v1/invoices/{invoice.id}/adjustment-requests",
        headers=headers,
        json={
            "request_type": "discount",
            "reason": "تعديل خصم",
            "requested_values": {"new_value": 10},
        },
    )
    assert denied.status_code == 400, denied.text
    assert "مقفل" in denied.json()["detail"]


def test_archive_lists_month_drafts_and_finalizes_them(client, db_session):
    make_user(db_session, username="archive_admin", role="admin")
    headers = auth_headers(client, username="archive_admin")
    _seed_customer(db_session, phone="01004000007")
    customer = _seed_customer(db_session, phone="01004000008")
    draft = _seed_invoice(
        db_session,
        customer.customer_id,
        250,
        "INV-AR-DRAFT-3",
        -2,
        is_draft=True,
    )
    _seed_item(db_session, draft)

    listed = client.get(
        f"/api/v1/invoices/archive/{_month_key(-2)}/drafts",
        headers=headers,
    )
    assert listed.status_code == 200, listed.text
    assert [row["id"] for row in listed.json()] == [draft.id]

    finalized = client.post(
        f"/api/v1/invoices/drafts/{draft.id}/finalize",
        headers=headers,
    )
    assert finalized.status_code == 200, finalized.text

    resp = client.get("/api/v1/invoices/archive/monthly", headers=headers)
    month = next(row for row in resp.json() if row["key"] == _month_key(-2))
    assert month["draft_count"] == 0
    assert month["invoice_count"] == 1
    assert month["total_amount"] == 250.0


def test_locked_month_refuses_to_finalize_a_draft(client, db_session):
    make_user(db_session, username="archive_admin", role="admin")
    headers = auth_headers(client, username="archive_admin")
    _seed_customer(db_session, phone="01004000009")
    customer = _seed_customer(db_session, phone="01004000010")
    _seed_invoice(db_session, customer.customer_id, 100, "INV-AR-LOCKED", -2)

    locked = client.post(
        f"/api/v1/invoices/archive/monthly/{_month_key(-2)}/close",
        headers=headers,
    )
    assert locked.status_code == 200, locked.text

    draft = _seed_invoice(
        db_session,
        customer.customer_id,
        150,
        "INV-AR-LATE-DRAFT",
        -2,
        is_draft=True,
    )
    _seed_item(db_session, draft)

    refused = client.post(
        f"/api/v1/invoices/drafts/{draft.id}/finalize",
        headers=headers,
    )
    assert refused.status_code == 400, refused.text
    assert "مقفل" in refused.json()["detail"]


def test_month_with_only_drafts_stays_visible_in_the_archive(client, db_session):
    make_user(db_session, username="archive_admin", role="admin")
    headers = auth_headers(client, username="archive_admin")
    customer = _seed_customer(db_session, phone="01004000011")
    _seed_invoice(
        db_session,
        customer.customer_id,
        300,
        "INV-AR-ONLY-DRAFT",
        -2,
        is_draft=True,
    )

    resp = client.get("/api/v1/invoices/archive/monthly", headers=headers)
    assert resp.status_code == 200, resp.text
    month = next(row for row in resp.json() if row["key"] == _month_key(-2))
    assert month["invoice_count"] == 0
    assert month["draft_count"] == 1
    assert month["total_amount"] == 0.0
    assert month["status"] == "open"
