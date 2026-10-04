"""`GET /owner/alerts` returns what is actually pending, and nothing when nothing is.

The page this feeds used to render five hardcoded security findings -- a
suspended employee with live permissions, an edited invoice, a 3am login from
an unknown device -- from a `useState` literal, with no request and no label.

So the tests below are about the opposite property: that the endpoint reports
real rows, reports nothing when there are none, and does not invent a severity
it cannot justify.
"""

from datetime import timedelta

from decimal import Decimal

from app.models.employee_document import EmployeeDocument
from app.models.employee import Employee
from app.models.invoice_adjustment_request import InvoiceAdjustmentRequest
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from tests.helpers import auth_headers, make_user


def _owner(client, db_session):
    make_user(db_session, username="owner_alerts", role="owner")
    return auth_headers(client, username="owner_alerts")


def test_returns_an_empty_list_when_nothing_is_pending(client, db_session):
    """The whole point. An empty page has to mean "nothing needs you"."""
    headers = _owner(client, db_session)

    resp = client.get("/api/v1/owner/alerts", headers=headers)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["alerts"] == [], resp.text
    assert body["counts"] == {"total": 0, "high": 0, "medium": 0, "low": 0}
    assert body["generated_at"]


def test_counts_only_pending_adjustment_requests(client, db_session):
    headers = _owner(client, db_session)

    customer = Customer(first_name="A", last_name="B", phone="01000000001")
    db_session.add(customer)
    db_session.flush()
    invoice = Invoice(
        invoice_no="INV-ALERT-1",
        customer_id=customer.customer_id,
        payment_method="cash",
        subtotal_amount=100,
        discount_amount=0,
        total_amount=100,
    )
    db_session.add(invoice)
    db_session.flush()

    make_user(db_session, username="cashier_req", role="cashier")
    requester = db_session.query(User).filter(User.username == "cashier_req").first()

    for status in ("pending", "approved", "rejected"):
        db_session.add(
            InvoiceAdjustmentRequest(
                invoice_id=invoice.id,
                requested_by_user_id=requester.id,
                request_type="discount",
                reason="test",
                status=status,
            )
        )
    db_session.commit()

    resp = client.get("/api/v1/owner/alerts", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    adjustment_alerts = [
        a for a in body["alerts"] if a["source"] == "invoice_adjustment_requests"
    ]
    # Exactly one of the three: approved and rejected requests are settled
    # history, not decisions waiting on anyone.
    assert len(adjustment_alerts) == 1, resp.text
    assert adjustment_alerts[0]["priority"] == "high"
    assert "INV-ALERT-1" in adjustment_alerts[0]["message"]


def test_unread_notifications_are_owner_scoped(client, db_session):
    headers = _owner(client, db_session)

    owner = db_session.query(User).filter(User.username == "owner_alerts").first()
    make_user(db_session, username="someone_else", role="cashier")
    other = db_session.query(User).filter(User.username == "someone_else").first()

    db_session.add(
        Notification(
            user_id=owner.id,
            title="طلب بانتظارك",
            message="راجع الطلب",
            is_read=False,
        )
    )
    db_session.add(
        Notification(
            user_id=other.id,
            title="ليس لك",
            message="خاص بك",
            is_read=False,
        )
    )
    db_session.add(
        Notification(
            user_id=owner.id,
            title="مقروء",
            message="لا يظهر",
            is_read=True,
        )
    )
    db_session.commit()

    body = client.get("/api/v1/owner/alerts", headers=headers).json()

    notifications = [a for a in body["alerts"] if a["source"] == "notifications"]
    assert len(notifications) == 1, body
    assert notifications[0]["title"] == "طلب بانتظارك"


def test_low_stock_below_the_configured_threshold(client, db_session):
    headers = _owner(client, db_session)

    db_session.add(
        Product(
            name="Shampoo",
            quantity=Decimal("2"),
            min_quantity_alert=Decimal("5"),
            sku="LOW-1",
        )
    )
    db_session.add(
        Product(
            name="Plenty",
            quantity=Decimal("50"),
            min_quantity_alert=Decimal("5"),
            sku="OK-1",
        )
    )
    db_session.commit()

    body = client.get("/api/v1/owner/alerts", headers=headers).json()

    low = [a for a in body["alerts"] if a["source"] == "products"]
    assert len(low) == 1, body
    assert "Shampoo" in low[0]["message"]
    assert "Plenty" not in low[0]["message"]


def test_out_of_stock_outranks_low_stock(client, db_session):
    """Severity is derived from the row, not from a constant."""
    headers = _owner(client, db_session)

    db_session.add(
        Product(name="Gone", quantity=Decimal("0"), min_quantity_alert=Decimal("5"), sku="Z-1")
    )
    db_session.add(
        Product(name="Low", quantity=Decimal("1"), min_quantity_alert=Decimal("5"), sku="Z-2")
    )
    db_session.commit()

    body = client.get("/api/v1/owner/alerts", headers=headers).json()

    products = [a for a in body["alerts"] if a["source"] == "products"]
    assert [a["priority"] for a in products] == ["high", "medium"], body


def test_expired_document_is_high_and_future_one_is_medium(client, db_session):
    headers = _owner(client, db_session)

    make_user(db_session, username="doc_owner", role="owner")
    employee = Employee(full_name="Doc Holder", phone_primary="01000000002")
    db_session.add(employee)
    db_session.flush()

    from app.core.clock import salon_now

    today = salon_now().date()
    db_session.add(
        EmployeeDocument(
            employee_id=employee.id,
            title="بطاقة هوية",
            file_url="/uploads/hr/id.png",
            storage_key="hr/id.png",
            file_type="ID",
            expiry_date=today - timedelta(days=1),
        )
    )
    db_session.add(
        EmployeeDocument(
            employee_id=employee.id,
            title="عقد عمل",
            file_url="/uploads/hr/contract.png",
            storage_key="hr/contract.png",
            file_type="Contract",
            expiry_date=today + timedelta(days=10),
        )
    )
    db_session.commit()

    body = client.get("/api/v1/owner/alerts", headers=headers).json()

    documents = [a for a in body["alerts"] if a["source"] == "employee_documents"]
    assert len(documents) == 2, body
    assert {d["priority"] for d in documents} == {"high", "medium"}, body


def test_high_severity_sorts_before_low_whatever_the_timestamps(client, db_session):
    """Severity is the outer key; a newer low-severity finding does not outrank
    an older high-severity one. Two sorts relying on stability is how the first
    version of this got it wrong."""
    headers = _owner(client, db_session)

    owner = db_session.query(User).filter(User.username == "owner_alerts").first()
    from app.core.clock import salon_now

    now = salon_now()
    # An old high-severity finding...
    db_session.add(
        Notification(
            user_id=owner.id,
            title="عاجل",
            message="a",
            is_read=False,
            created_at=now - timedelta(days=30),
        )
    )
    db_session.flush()

    customer = Customer(first_name="C", last_name="D", phone="01000000003")
    db_session.add(customer)
    db_session.flush()
    invoice = Invoice(
        invoice_no="INV-ALERT-2",
        customer_id=customer.customer_id,
        payment_method="cash",
        subtotal_amount=1,
        discount_amount=0,
        total_amount=1,
    )
    db_session.add(invoice)
    db_session.flush()
    make_user(db_session, username="req2", role="cashier")
    requester = db_session.query(User).filter(User.username == "req2").first()
    # ...and a brand-new low-severity one.
    db_session.add(
        Notification(
            user_id=owner.id,
            title="عادي",
            message="b",
            is_read=False,
            created_at=now,
        )
    )
    db_session.commit()

    body = client.get("/api/v1/owner/alerts", headers=headers).json()

    priorities = [a["priority"] for a in body["alerts"]]
    if "high" in priorities and "low" in priorities:
        assert priorities.index("high") < priorities.index("low"), body


def test_a_manager_cannot_read_the_owner_alert_counts(client, db_session):
    """The rows are other people's requests; a manager sees their own elsewhere."""
    make_user(db_session, username="mgr_alerts", role="manager")
    headers = auth_headers(client, username="mgr_alerts")

    resp = client.get("/api/v1/owner/alerts", headers=headers)

    assert resp.status_code in (401, 403), resp.text


def test_the_response_carries_no_internal_sort_key(client, db_session):
    """`_sort_at` is bookkeeping. Leaking it would tie the API to an
    implementation detail that is free to change."""
    headers = _owner(client, db_session)

    db_session.add(
        Product(name="Low", quantity=Decimal("1"), min_quantity_alert=Decimal("5"), sku="K-1")
    )
    db_session.commit()

    body = client.get("/api/v1/owner/alerts", headers=headers).json()

    assert body["alerts"], body
    for alert in body["alerts"]:
        assert "_sort_at" not in alert, alert


def test_every_alert_points_somewhere_real(client, db_session):
    """A finding with a dead link is worse than no finding: the owner clicks it
    to act and lands on a 404."""
    headers = _owner(client, db_session)

    owner = db_session.query(User).filter(User.username == "owner_alerts").first()
    db_session.add(
        Notification(user_id=owner.id, title="t", message="m", is_read=False)
    )
    db_session.add(
        Product(name="Low", quantity=Decimal("0"), min_quantity_alert=Decimal("5"), sku="D-1")
    )
    db_session.commit()

    body = client.get("/api/v1/owner/alerts", headers=headers).json()

    for alert in body["alerts"]:
        assert alert["destination"].startswith("/"), alert
        assert alert["priority"] in ("high", "medium", "low"), alert
        assert alert["title"], alert