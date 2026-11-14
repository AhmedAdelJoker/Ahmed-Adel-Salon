"""POS close-shift discrepancy policy + archived shift stats.

Covers two behaviours added on top of the audited close flow:

1. `financial_rules.maxCashDiscrepancyWithoutNote` (an owner-facing control that
   previously existed in the UI with no backend enforcement) now actually gates
   `POST /pos-shifts/{id}/close`: beyond the configured variance the close must
   carry an explanatory note, and a cashier additionally needs a manager's
   co-signature (username/password). 0 keeps the pre-gate behaviour.
2. `GET /pos-shifts/{shift_id}/stats` reprints a closed shift's money figures
   from its stored window, and a cashier may not read another user's shift.
"""
import pytest
from decimal import Decimal

import app.services.runtime_settings_service as runtime_settings_service
from app.core.clock import utc_now_naive
from app.models.customer import Customer
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.pos_shift import PosShift
from tests.helpers import auth_headers, make_user


@pytest.fixture(autouse=True)
def _isolated_runtime_settings(tmp_path, monkeypatch):
    """Point runtime settings at a tmp file so financial-rules writes never
    leak into the repository's runtime_data or between tests."""
    monkeypatch.setattr(
        runtime_settings_service,
        "_RUNTIME_SETTINGS_PATH",
        tmp_path / "runtime_settings.json",
        raising=False,
    )


def _set_discrepancy_limit(value):
    runtime_settings_service.update_runtime_settings(
        "financial_rules",
        {"maxCashDiscrepancyWithoutNote": value},
        {"maxCashDiscrepancyWithoutNote": 0},
    )


def _seed_cashier(db_session, username="cashier_policy", phone="01120000001"):
    user = make_user(db_session, username=username, role="cashier")
    customer = Customer(first_name="عميل", last_name="سياسة", phone=phone)
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return user, customer


def _open_shift(db_session, user, opening_cash="100"):
    shift = PosShift(
        user_id=user.id,
        status="open",
        opened_at=utc_now_naive(),
        opening_cash=Decimal(str(opening_cash)),
    )
    db_session.add(shift)
    db_session.commit()
    db_session.refresh(shift)
    return shift


def _seed_invoice(db_session, user, customer, amount, method="CASH", tag=""):
    row = Invoice(
        invoice_no=f"INV-POL-{tag}-{amount}-{method}",
        customer_id=customer.customer_id,
        created_by_user_id=user.id,
        payment_method=method,
        subtotal_amount=Decimal(str(amount)),
        total_amount=Decimal(str(amount)),
        discount_amount=Decimal("0"),
        created_at=utc_now_naive(),
    )
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    return row


def _close(client, shift_id, **fields):
    return client.post(
        f"/api/v1/pos-shifts/{shift_id}/close",
        json=fields,
        headers=auth_headers(client, username="cashier_policy"),
    )


def test_close_within_limit_needs_no_note(client, db_session):
    user, customer = _seed_cashier(db_session)
    shift = _open_shift(db_session, user)
    _seed_invoice(db_session, user, customer, 100, tag="within")
    _set_discrepancy_limit(50)

    # expected = 100 + 100 = 200; counted 215 → +15 variance, inside the limit
    resp = _close(client, shift.id, countedCash=215)

    assert resp.status_code == 200, resp.text
    assert resp.json()["shift"]["status"] == "closed"
    assert float(resp.json()["shift"]["actual_closing_cash"]) == 215


def test_close_beyond_limit_requires_note(client, db_session):
    user, customer = _seed_cashier(db_session, phone="01120000002")
    shift = _open_shift(db_session, user)
    _seed_invoice(db_session, user, customer, 100, tag="note")
    _set_discrepancy_limit(10)

    # expected = 200; counted 310 → +110 variance, no note
    resp = _close(client, shift.id, countedCash=310)

    assert resp.status_code == 400, resp.text
    assert "ملاحظة" in resp.json()["detail"]


def test_close_beyond_limit_cashier_requires_manager_credentials(
    client, db_session
):
    user, customer = _seed_cashier(db_session)
    make_user(
        db_session, username="manager_policy", password="Manager123", role="manager"
    )
    shift = _open_shift(db_session, user)
    _seed_invoice(db_session, user, customer, 100, tag="gate")
    _set_discrepancy_limit(10)

    # Wrong approver credentials are refused and the shift stays open.
    denied = client.post(
        f"/api/v1/pos-shifts/{shift.id}/close",
        json={
            "countedCash": 310,
            "closing_note": "عقل كاشير",
            "approver_username": "manager_policy",
            "approver_password": "WrongPass1",
        },
        headers=auth_headers(client, username="cashier_policy"),
    )
    assert denied.status_code == 403, denied.text
    db_session.refresh(shift)
    assert shift.status == "open"

    # Correct manager credentials unlock the close.
    resp = client.post(
        f"/api/v1/pos-shifts/{shift.id}/close",
        json={
            "countedCash": 310,
            "closing_note": "عقل كاشير مؤكد",
            "approver_username": "manager_policy",
            "approver_password": "Manager123",
        },
        headers=auth_headers(client, username="cashier_policy"),
    )
    assert resp.status_code == 200, resp.text
    db_session.refresh(shift)
    assert shift.status == "closed"
    assert shift.closing_note == "عقل كاشير مؤكد"


def test_close_beyond_limit_manager_needs_note_only(client, db_session):
    """A manager closing their own shift is trusted with the figure itself."""
    _seed_cashier(db_session, username="someone_else", phone="01120000004")
    manager = make_user(
        db_session, username="manager_native", password="Manager123", role="manager"
    )
    customer = Customer(first_name="عميل", last_name="مدير", phone="01120000005")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    shift = _open_shift(db_session, manager)
    _seed_invoice(
        db_session,
        manager,
        customer,
        100,
        tag="mgr",
    )
    _set_discrepancy_limit(10)

    # No note → still refused (the policy is note-based, not role-only).
    no_note = client.post(
        f"/api/v1/pos-shifts/{shift.id}/close",
        json={"countedCash": 310},
        headers=auth_headers(client, username="manager_native", password="Manager123"),
    )
    assert no_note.status_code == 400, no_note.text

    resp = client.post(
        f"/api/v1/pos-shifts/{shift.id}/close",
        json={"countedCash": 310, "closing_note": "جرد الشبكة أخير"},
        headers=auth_headers(client, username="manager_native", password="Manager123"),
    )
    assert resp.status_code == 200, resp.text


def test_archived_shift_stats_readable_and_scoped(client, db_session):
    user, customer = _seed_cashier(db_session)
    make_user(db_session, username="cashier_other")
    shift = _open_shift(db_session, user)
    _seed_invoice(db_session, user, customer, 200, method="CASH", tag="arch")
    _seed_invoice(
        db_session, user, customer, 300, method="CARD", tag="arch"
    )
    db_session.add(
        Expense(
            amount=50,
            category="supplies",
            payment_method="cash",
            status="approved",
            created_by_user_id=user.id,
            created_at=utc_now_naive(),
        )
    )
    db_session.commit()

    close_resp = _close(client, shift.id, countedCash=250)
    assert close_resp.status_code == 200, close_resp.text

    # Own reprint: figures mirror the close arithmetic.
    headers = auth_headers(client, username="cashier_policy")
    stats = client.get(f"/api/v1/pos-shifts/{shift.id}/stats", headers=headers)
    assert stats.status_code == 200, stats.text
    body = stats.json()["stats"]
    assert body["total_sales"] == 500.0
    assert body["cash_sales"] == 200.0
    assert body["card_sales"] == 300.0
    assert body["cash_expenses"] == 50.0
    assert body["expected_closing_cash"] == 250.0
    assert body["actual_closing_cash"] == 250.0
    assert body["invoice_count"] == 2

    # Another cashier may not reprint someone else's shift.
    other = client.get(
        f"/api/v1/pos-shifts/{shift.id}/stats",
        headers=auth_headers(client, username="cashier_other"),
    )
    assert other.status_code == 403, other.text


def test_current_stats_publish_the_discrepancy_limit(client, db_session):
    """The close dialog needs the limit up front to ask for the note and the
    co-signature in one pass, instead of after a refused attempt."""
    user, customer = _seed_cashier(db_session, username="cashier_stats", phone="01120000007")
    shift = _open_shift(db_session, user)
    _seed_invoice(db_session, user, customer, 100, tag="stats")
    _set_discrepancy_limit(25)

    resp = client.get(
        "/api/v1/pos-shifts/current/stats",
        headers=auth_headers(client, username="cashier_stats"),
    )
    assert resp.status_code == 200, resp.text
    stats = resp.json()["stats"]
    assert stats is not None
    assert stats["discrepancy_limit"] == 25.0
    assert stats["expected_closing_cash"] == 200.0
    del shift


def test_list_shifts_visibility_by_role(client, db_session):
    user_a, customer = _seed_cashier(db_session)
    user_b = make_user(db_session, username="cashier_other")
    shift_a = _open_shift(db_session, user_a)
    shift_b = _open_shift(db_session, user_b)

    own = client.get("/api/v1/pos-shifts", headers=auth_headers(client, username="cashier_policy"))
    assert own.status_code == 200
    assert [s["id"] for s in own.json()] == [shift_a.id]

    make_user(db_session, username="manager_sees", password="Manager123", role="manager")
    everything = client.get(
        "/api/v1/pos-shifts",
        headers=auth_headers(client, username="manager_sees", password="Manager123"),
    )
    assert everything.status_code == 200
    assert {s["id"] for s in everything.json()} == {shift_a.id, shift_b.id}
    del customer
