from datetime import datetime
from decimal import Decimal

import pytest
from starlette.websockets import WebSocketDisconnect

from app.models.customer import Customer
from app.models.employee import Employee
from app.models.employee_document import EmployeeDocument
from app.models.invoice import Invoice
from app.models.notification import Notification
from tests.helpers import auth_headers, login, make_user


def _invoice(db_session, user_id: int) -> Invoice:
    customer = Customer(first_name="Test", last_name="Customer", phone="01000009999")
    db_session.add(customer)
    db_session.flush()
    invoice = Invoice(
        invoice_no="INV-P0-001",
        customer_id=customer.customer_id,
        payment_method="cash",
        subtotal_amount=Decimal("100.00"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("100.00"),
        created_by_user_id=user_id,
        created_at=datetime.now(),
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)
    return invoice


def _employee(db_session) -> Employee:
    employee = Employee(
        full_name="Document Employee",
        phone_primary="01000008888",
        job_title="barber",
    )
    db_session.add(employee)
    db_session.commit()
    db_session.refresh(employee)
    return employee


def test_invoice_adjustment_endpoints_require_auth(client, db_session):
    user = make_user(db_session, username="cashierp0", role="cashier")
    invoice = _invoice(db_session, user.id)
    create_url = f"/api/v1/invoices/{invoice.id}/adjustment-requests"

    assert client.get("/api/v1/invoice-adjustment-requests").status_code in (401, 403)
    assert client.post(
        create_url,
        json={
            "request_type": "discount",
            "reason": "خصم تجريبي",
            "requested_values": {"new_value": 10},
        },
    ).status_code in (401, 403)
    assert client.post(
        "/api/v1/invoice-adjustment-requests/1/approve",
        json={},
    ).status_code in (401, 403)


def test_invoice_adjustment_pin_cannot_approve_request(client, db_session):
    cashier = make_user(db_session, username="cashierp0", role="cashier")
    make_user(db_session, username="managerp0", role="manager")
    invoice = _invoice(db_session, cashier.id)

    created = client.post(
        f"/api/v1/invoices/{invoice.id}/adjustment-requests",
        headers=auth_headers(client, username="cashierp0"),
        json={
            "request_type": "discount",
            "reason": "خصم يحتاج مراجعة",
            "requested_values": {"new_value": 15},
            "manager_pin": "1234",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "pending"
    request_id = created.json()["id"]

    approved = client.post(
        f"/api/v1/invoice-adjustment-requests/{request_id}/approve",
        headers=auth_headers(client, username="managerp0"),
        json={"manager_note": "تمت المراجعة", "manager_pin": "1234"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"

    db_session.expire_all()
    invoice = db_session.query(Invoice).filter(Invoice.id == invoice.id).one()
    assert invoice.discount_amount == Decimal("15.00")
    assert invoice.total_amount == Decimal("85.00")


def test_shop_settings_require_owner_for_writes(client, db_session):
    make_user(db_session, username="managerp0", role="manager")
    make_user(db_session, username="ownerp0", role="owner")

    assert client.get("/api/v1/shop-settings/").status_code in (401, 403)
    assert client.put(
        "/api/v1/shop-settings/",
        json={"shop_name": "Blocked"},
    ).status_code in (401, 403)
    assert client.put(
        "/api/v1/shop-settings/",
        headers=auth_headers(client, username="managerp0"),
        json={"shop_name": "Blocked"},
    ).status_code == 403

    updated = client.put(
        "/api/v1/shop-settings/",
        headers=auth_headers(client, username="ownerp0"),
        json={"shop_name": "Allowed", "tax_rate": 15},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["shop_name"] == "Allowed"

    invalid = client.put(
        "/api/v1/shop-settings/",
        headers=auth_headers(client, username="ownerp0"),
        json={"tax_rate": 150},
    )
    assert invalid.status_code == 422


def test_manager_cannot_escalate_employee_role(client, db_session):
    make_user(db_session, username="managerp0", role="manager")
    payload = {
        "full_name": "Escalation Attempt",
        "phone_primary": "01000007777",
        "job_title": "barber",
        "has_login_account": True,
        "username": "escalated",
        "password": "StrongPass123",
        "role": "owner",
    }

    response = client.post(
        "/api/v1/employees",
        headers=auth_headers(client, username="managerp0"),
        json=payload,
    )
    assert response.status_code == 403, response.text


def test_manager_cannot_modify_employee_linked_to_higher_role(client, db_session):
    owner = make_user(db_session, username="ownerp0", role="owner")
    make_user(db_session, username="managerp0", role="manager")
    employee = Employee(
        full_name="Owner Employee",
        phone_primary="01000005555",
        job_title="owner",
    )
    db_session.add(employee)
    db_session.flush()
    employee.user_id = owner.id
    db_session.commit()

    response = client.put(
        f"/api/v1/employees/{employee.id}",
        headers=auth_headers(client, username="managerp0"),
        json={"full_name": "Blocked Change"},
    )
    assert response.status_code == 403, response.text


def test_manager_can_create_barber_login_with_valid_password(client, db_session):
    make_user(db_session, username="managerp0", role="manager")
    payload = {
        "full_name": "Valid Barber",
        "phone_primary": "01000006666",
        "job_title": "barber",
        "has_login_account": True,
        "username": "validbarber",
        "password": "StrongPass123",
        "role": "barber",
    }

    response = client.post(
        "/api/v1/employees",
        headers=auth_headers(client, username="managerp0"),
        json=payload,
    )
    assert response.status_code == 201, response.text

    weak = client.post(
        "/api/v1/employees",
        headers=auth_headers(client, username="managerp0"),
        json={**payload, "username": "weakbarber", "password": "weak"},
    )
    assert weak.status_code == 400, weak.text


def test_refresh_token_is_invalidated_after_password_change(client, db_session):
    make_user(db_session, username="refreshp0", password="OldPass123")
    login_body = login(client, "refreshp0", "OldPass123").json()
    access = login_body["access_token"]
    refresh = login_body["refresh_token"]
    changed = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access}"},
        json={"current_password": "OldPass123", "new_password": "NewPass456"},
    )
    assert changed.status_code == 200, changed.text

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh},
    )
    assert refreshed.status_code == 401, refreshed.text


def test_websocket_rejects_missing_token(client, db_session):
    user = make_user(db_session, username="socketp0", role="cashier")
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/api/v1/notifications/ws/{user.id}"
        ) as websocket:
            websocket.receive_text()


def test_websocket_rejects_token_for_another_user(client, db_session):
    first = make_user(db_session, username="socketone", role="cashier")
    second = make_user(db_session, username="sockettwo", role="cashier")
    access = login(client, "socketone", "Cashier123").json()["access_token"]

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/api/v1/notifications/ws/{second.id}",
            subprotocols=["access-token", access],
        ) as websocket:
            websocket.receive_text()
    assert first.id != second.id


def test_notification_read_is_scoped_to_owner_user(client, db_session):
    first = make_user(db_session, username="notifyone", role="cashier")
    second = make_user(db_session, username="notifytwo", role="cashier")
    notification = Notification(
        user_id=second.id,
        user_role=second.role,
        title="Private",
        message="Private message",
    )
    db_session.add(notification)
    db_session.commit()

    response = client.patch(
        f"/api/v1/notifications/{notification.id}/read",
        headers=auth_headers(client, username="notifyone"),
    )
    assert response.status_code == 404


def test_employee_document_is_private_and_path_safe(
    client,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    make_user(db_session, username="ownerp0", role="owner")
    employee = _employee(db_session)
    pdf = b"%PDF-1.4\nsecure document\n%%EOF"

    uploaded = client.post(
        f"/api/v1/employees/{employee.id}/documents",
        headers=auth_headers(client, username="ownerp0"),
        data={"title": "Contract", "file_type": "../../contract"},
        files={"file": ("contract.pdf", pdf, "application/pdf")},
    )
    assert uploaded.status_code == 200, uploaded.text

    document = db_session.query(EmployeeDocument).filter(
        EmployeeDocument.id == uploaded.json()["id"]
    ).one()
    assert "/" not in document.storage_key
    assert "\\" not in document.storage_key
    assert "/" not in document.file_type
    assert "\\" not in document.file_type
    stored_path = tmp_path / "documents" / document.storage_key
    assert stored_path.read_bytes() == pdf

    public = client.get(f"/uploads/documents/{document.storage_key}")
    assert public.status_code == 404

    downloaded = client.get(
        f"/api/v1/employees/documents/{document.id}/download",
        headers=auth_headers(client, username="ownerp0"),
    )
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == pdf
