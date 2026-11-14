"""Integrity tests for the expenses ledger.

Covers the guarantees this change introduced:

* approval moves money exactly once (idempotent), approving again does not
  write a second cash transaction
* rejecting only works from `pending_audit` — a rejected-after-approve
  scenario must 409 and leave the cash box untouched
* the client can never set `status` via PUT; edits are audited; an edit of
  amount/payment method on an APPROVED expense voids and re-creates the
  linked cash transaction
* internal_notes is stripped for anyone but owner/admin
* the summary's money totals exclude rejected rows and expose pending
  separately
"""

import pytest
from tests.helpers import auth_headers, make_user

from app.crud.core_business import create_cash_transaction
from app.models.cash_transaction import CashTransaction
from app.models.expense import Expense


def _seed_cash(db_session, user_id, amount: float = 5000.0):
    """Deposit test money into the box — approvals move cash out."""
    create_cash_transaction(
        db_session,
        direction="in",
        amount=amount,
        transaction_type="opening_balance",
        user_id=user_id,
    )


def _create_as(client, headers, payload):
    resp = client.post("/api/v1/expenses", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_cashier_created_expense_is_pending_and_owner_approval_moves_money_once(
    client, db_session
):
    make_user(db_session, username="cashier1", password="Cashier123", role="cashier")
    owner = make_user(db_session, username="owner1", password="Ownerpass1", role="owner")

    cashier_headers = auth_headers(client, "cashier1", "Cashier123")
    owner_headers = auth_headers(client, "owner1", "Ownerpass1")
    _seed_cash(db_session, owner.id)

    created = _create_as(
        client,
        cashier_headers,
        {"title": "أدوات", "amount": 250.0, "category": "أخرى"},
    )
    eid = created["id"]
    assert created["status"] == "pending_audit"

    # Pending → approve: exactly one outbound cash movement is recorded.
    resp = client.post(f"/api/v1/expenses/{eid}/approve", headers=owner_headers)
    assert resp.status_code == 200, resp.text
    moves = db_session.query(CashTransaction).filter(
        CashTransaction.reference_type == "expense",
        CashTransaction.reference_id == eid,
        CashTransaction.type == "expense_payment",
    ).all()
    assert len(moves) == 1
    assert float(moves[0].amount) == 250.0

    # Approving a second time is a no-op: still exactly one movement on the box.
    resp = client.post(f"/api/v1/expenses/{eid}/approve", headers=owner_headers)
    assert resp.status_code == 200, resp.text
    moves = db_session.query(CashTransaction).filter(
        CashTransaction.reference_type == "expense",
        CashTransaction.reference_id == eid,
        CashTransaction.type == "expense_payment",
    ).all()
    assert len(moves) == 1


def test_reject_requires_pending_audit(client, db_session):
    owner = make_user(db_session, username="owner2", password="Ownerpass2", role="owner")
    owner_headers = auth_headers(client, "owner2", "Ownerpass2")
    _seed_cash(db_session, owner.id)

    created = _create_as(
        client,
        owner_headers,
        {"title": "إيجار", "amount": 1000.0, "category": "إيجار", "recipient_name": "مالك المحل"},
    )
    eid = created["id"]
    assert created["status"] == "approved"

    resp = client.post(f"/api/v1/expenses/{eid}/reject", headers=owner_headers)
    assert resp.status_code == 409

    # The approved expense keeps its (single) cash movement.
    moves = db_session.query(CashTransaction).filter(
        CashTransaction.reference_type == "expense",
        CashTransaction.reference_id == eid,
    ).all()
    assert len(moves) == 1


def test_reject_pending_expense_works(client, db_session):
    make_user(db_session, username="cashier3", password="Cashier123", role="cashier")
    make_user(db_session, username="owner3", password="Ownerpass3", role="owner")
    cashier_headers = auth_headers(client, "cashier3", "Cashier123")
    owner_headers = auth_headers(client, "owner3", "Ownerpass3")

    created = _create_as(
        client,
        cashier_headers,
        {"title": "صيانة", "amount": 120.0, "category": "صيانة"},
    )
    eid = created["id"]

    resp = client.post(f"/api/v1/expenses/{eid}/reject", headers=owner_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "rejected"

    # No cash movement exists for a rejected pending expense.
    moves = db_session.query(CashTransaction).filter(
        CashTransaction.reference_type == "expense",
        CashTransaction.reference_id == eid,
    ).all()
    assert moves == []


def test_put_cannot_change_status_and_is_audited(client, db_session):
    from app.models.activity_log import ActivityLog

    owner = make_user(db_session, username="owner4", password="Ownerpass4", role="owner")
    owner_headers = auth_headers(client, "owner4", "Ownerpass4")
    _seed_cash(db_session, owner.id)

    created = _create_as(
        client,
        owner_headers,
        {"title": "فواتير", "amount": 90.0, "category": "إنترنت"},
    )
    eid = created["id"]

    resp = client.put(
        f"/api/v1/expenses/{eid}",
        json={"category": "إنترنت", "amount": 90.0, "status": "rejected"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text
    # Client-supplied status must be ignored — lifecycle moves only via
    # /approve and /reject.
    assert resp.json()["status"] == "approved"

    logs = db_session.query(ActivityLog).filter(
        ActivityLog.entity_type == "expense",
        ActivityLog.entity_id == eid,
        ActivityLog.action == "update_expense",
    ).all()
    assert logs, "update_expense must leave an audit trail"


def test_editing_amount_on_approved_expense_voids_and_rewrites_cash_movement(
    client, db_session
):
    owner = make_user(db_session, username="owner5", password="Ownerpass5", role="owner")
    owner_headers = auth_headers(client, "owner5", "Ownerpass5")
    _seed_cash(db_session, owner.id)

    created = _create_as(
        client,
        owner_headers,
        {"title": "تسويق", "amount": 300.0, "category": "تسويق"},
    )
    eid = created["id"]

    resp = client.put(
        f"/api/v1/expenses/{eid}",
        json={"category": "تسويق", "amount": 450.0, "title": "تسويق"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text

    moves = db_session.query(CashTransaction).filter(
        CashTransaction.reference_type == "expense",
        CashTransaction.reference_id == eid,
    ).all()
    active = [m for m in moves if not m.is_voided]
    voided = [m for m in moves if m.is_voided]
    assert len(active) == 1
    assert len(voided) == 1
    assert float(active[0].amount) == 450.0
    assert voided[0].void_reason == "expense_edited"


def test_internal_notes_hidden_from_non_owner(client, db_session):
    make_user(db_session, username="cashier6", password="Cashier123", role="cashier")
    owner = make_user(db_session, username="owner6", password="Ownerpass6", role="owner")
    cashier_headers = auth_headers(client, "cashier6", "Cashier123")
    owner_headers = auth_headers(client, "owner6", "Ownerpass6")
    _seed_cash(db_session, owner.id)

    created = _create_as(
        client,
        owner_headers,
        {"title": "مرتب", "amount": 2000.0, "category": "رواتب", "internal_notes": "ملاحظة سرية للمالك"},
    )
    eid = created["id"]

    resp = client.get("/api/v1/expenses", headers=cashier_headers)
    assert resp.status_code == 200, resp.text
    for row in resp.json():
        if row["id"] == eid:
            assert row["internal_notes"] is None
    resp = client.get("/api/v1/expenses", headers=owner_headers)
    assert resp.status_code == 200, resp.text
    leaked = [row for row in resp.json() if row["id"] == eid and row["internal_notes"] == "ملاحظة سرية للمالك"]
    assert leaked, "owner must see internal_notes"


def test_summary_excludes_rejected_and_reports_pending(client, db_session):
    make_user(db_session, username="cashier7", password="Cashier123", role="cashier")
    owner = make_user(db_session, username="owner7", password="Ownerpass7", role="owner")
    cashier_headers = auth_headers(client, "cashier7", "Cashier123")
    owner_headers = auth_headers(client, "owner7", "Ownerpass7")
    _seed_cash(db_session, owner.id)

    approved = _create_as(
        client,
        owner_headers,
        {"title": "مقبول", "amount": 100.0, "category": "مشتريات", "recipient_name": "مورد"},
    )
    pending = _create_as(
        client,
        cashier_headers,
        {"title": "معلق", "amount": 40.0, "category": "أخرى"},
    )
    rejected = _create_as(
        client,
        cashier_headers,
        {"title": "سيُرفض", "amount": 55.0, "category": "أخرى"},
    )
    resp = client.post(f"/api/v1/expenses/{rejected['id']}/reject", headers=owner_headers)
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/expenses/summary", headers=owner_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Rejected 55 must not pollute the money total.
    assert body["total_amount"] == pytest.approx(100.0)
    assert body["count"] == 1
    assert body["pending_total"] == pytest.approx(40.0)
    assert body["pending_count"] == 1
    # Full audit breakdown keeps every status.
    assert body["status_breakdown"]["rejected"]["amount"] == pytest.approx(55.0)


def test_sort_rejects_unknown_field(client, db_session):
    make_user(db_session, username="owner8", password="Ownerpass8", role="owner")
    owner_headers = auth_headers(client, "owner8", "Ownerpass8")
    resp = client.get("/api/v1/expenses?sort=-metadata", headers=owner_headers)
    assert resp.status_code == 400


def test_trend_endpoint_is_approved_only_and_zero_filled(client, db_session):
    owner = make_user(db_session, username="owner9", password="Ownerpass9", role="owner")
    owner_headers = auth_headers(client, "owner9", "Ownerpass9")
    _seed_cash(db_session, owner.id)

    created = _create_as(
        client,
        owner_headers,
        {"title": "trend-check", "amount": 123.0, "category": "أخرى"},
    )
    assert created["status"] == "approved"

    resp = client.get("/api/v1/expenses/trend?months=6", headers=owner_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["months"]) == 6
    current = body["months"][-1]
    assert current["month"] == __import__("datetime").datetime.now().strftime("%Y-%m")
    assert current["total"] >= 123.0
    # Older zero-filled buckets exist and are non-negative
    for bucket in body["months"]:
        assert bucket["total"] >= 0
        assert bucket["count"] >= 0
