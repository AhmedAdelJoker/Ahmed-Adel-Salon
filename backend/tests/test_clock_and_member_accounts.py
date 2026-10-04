"""Salon timezone handling and the member-accounts split."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.core.clock import (
    coerce_naive,
    is_same_instant,
    resolve_timezone,
    salon_now,
    salon_timezone,
    to_salon,
    utc_now,
    utc_now_naive,
)
from app.core.security import get_password_hash, verify_password
from app.models.customer import Customer
from app.models.member_account import MemberAccount
from app.schemas.customer import CustomerRead


# --------------------------------------------------------------------------- clock


def test_resolve_timezone_returns_a_usable_tzinfo():
    zone = resolve_timezone("Africa/Cairo")
    assert zone is not None
    moment = datetime(2026, 9, 26, 12, 0, tzinfo=zone)
    assert moment.utcoffset() is not None


def test_resolve_timezone_falls_back_for_a_bogus_name():
    zone = resolve_timezone("Not/AZone")
    assert zone is not None
    assert datetime(2026, 9, 26, tzinfo=zone).utcoffset() is not None


def test_resolve_timezone_defaults_when_name_is_empty():
    assert resolve_timezone(None) is not None
    assert resolve_timezone("") is not None


def test_salon_now_is_naive_wall_clock():
    now = salon_now()
    assert now.tzinfo is None


def test_utc_now_is_aware():
    assert utc_now().tzinfo is not None


def test_salon_now_is_ahead_of_utc_for_cairo():
    delta = salon_now() - utc_now_naive()
    # Cairo is UTC+2 (or +3 with DST); either way the salon clock leads UTC.
    assert timedelta(hours=1) < delta < timedelta(hours=4)


def test_salon_timezone_matches_config():
    assert salon_timezone() is not None


def test_to_salon_converts_an_aware_utc_stamp():
    aware = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)
    local = to_salon(aware)
    assert local.tzinfo is None
    assert local.hour in (14, 15)  # UTC+2 / UTC+3


def test_to_salon_leaves_a_naive_stamp_alone():
    naive = datetime(2026, 9, 26, 12, 0)
    assert to_salon(naive) is naive


def test_coerce_naive_handles_none():
    assert coerce_naive(None) is None


def test_is_same_instant_across_representations():
    aware = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)
    naive_utc = datetime(2026, 9, 26, 12, 0)
    assert is_same_instant(aware, naive_utc) is True
    assert is_same_instant(aware, datetime(2026, 9, 26, 13, 0)) is False


# --------------------------------------------------------------------------- member accounts


def test_customer_no_longer_carries_a_password_hash():
    columns = {c.name for c in Customer.__table__.columns}
    assert "member_password_hash" not in columns
    assert "member_token_version" not in columns


def test_customer_read_schema_never_exposes_credentials():
    fields = set(CustomerRead.model_fields)
    assert "member_password_hash" not in fields
    assert "password_hash" not in fields
    assert "token_version" not in fields


def test_customer_serialization_has_no_hash():
    customer = Customer(
        customer_id=1,
        first_name="سارة",
        last_name="علي",
        phone="0100000000",
        email="s@example.com",
        loyalty_points=Decimal("0"),
        lifetime_spend=Decimal("0"),
        visits_count=0,
        current_tier="Bronze",
        cancellation_count=0,
        created_at=datetime(2026, 1, 1),
    )
    payload = CustomerRead.model_validate(customer).model_dump()
    assert "password" not in str(payload).lower()
    assert "hash" not in str(payload).lower()


def test_member_account_is_created_and_linked(db_session):
    customer = Customer(first_name="سارة", last_name="علي", phone="0100000001")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    account = MemberAccount(
        customer_id=customer.customer_id,
        password_hash=get_password_hash("Str0ngPass!23"),
        token_version=0,
        is_active=True,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(customer)

    assert customer.member_account is not None
    assert verify_password("Str0ngPass!23", customer.member_account.password_hash)


def test_deleting_a_customer_cascades_the_account(db_session):
    customer = Customer(first_name="سارة", last_name="علي", phone="0100000002")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    db_session.add(
        MemberAccount(
            customer_id=customer.customer_id,
            password_hash=get_password_hash("Str0ngPass!23"),
        )
    )
    db_session.commit()

    db_session.delete(customer)
    db_session.commit()
    assert db_session.query(MemberAccount).count() == 0


def test_only_one_account_per_customer(db_session):
    customer = Customer(first_name="سارة", last_name="علي", phone="0100000003")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    for _ in range(2):
        db_session.add(
            MemberAccount(
                customer_id=customer.customer_id,
                password_hash=get_password_hash("Str0ngPass!23"),
            )
        )
    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_inactive_account_blocks_login(client, db_session):
    from app.core.security import get_password_hash as _hash
    from tests.helpers import make_user

    make_user(db_session, username="staff1", role="owner")
    customer = Customer(
        first_name="سارة", last_name="علي", phone="0100000004", email="off@example.com"
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    db_session.add(
        MemberAccount(
            customer_id=customer.customer_id,
            password_hash=_hash("Str0ngPass!23"),
            is_active=False,
        )
    )
    db_session.commit()

    resp = client.post(
        "/api/v1/public/member/login",
        json={"email": "off@example.com", "password": "Str0ngPass!23"},
    )
    assert resp.status_code == 401, resp.text


def test_member_registration_stores_credentials_separately(client, db_session):
    resp = client.post(
        "/api/v1/public/member/register",
        json={
            "name": "سارة علي",
            "email": "new@example.com",
            "phone": "0100000005",
            "password": "Str0ngPass!23",
        },
    )
    assert resp.status_code == 201, resp.text

    customer = (
        db_session.query(Customer).filter(Customer.email == "new@example.com").first()
    )
    assert customer is not None
    assert not hasattr(customer, "member_password_hash")

    account = (
        db_session.query(MemberAccount)
        .filter(MemberAccount.customer_id == customer.customer_id)
        .first()
    )
    assert account is not None
    assert account.password_hash != "Str0ngPass!23"
    assert verify_password("Str0ngPass!23", account.password_hash)


def test_member_login_round_trip(client, db_session):
    from tests.helpers import make_user

    make_user(db_session, username="staff1", role="owner")
    registered = client.post(
        "/api/v1/public/member/register",
        json={
            "name": "سارة علي",
            "email": "rt@example.com",
            "phone": "0100000006",
            "password": "Str0ngPass!23",
        },
    )
    assert registered.status_code == 201, registered.text

    me = client.get(
        "/api/v1/public/member/me",
        headers={"Authorization": f"Bearer {registered.json()['token']}"},
    )
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "rt@example.com"
