"""Loyalty tier pricing must not depend on the stored tier NAME.

`current_tier` is a free-text string written from the owner-editable tier
names, so it can disagree with the configured ladder in two ways that both
silently voided a customer's discount:

  * a legacy row still holding "Bronze" while the configured names are Arabic
  * the owner renaming a tier in settings — every stored tier goes stale at
    once

The discount is therefore resolved from `visits_count`, the same authority
the tier is derived from when it is assigned. These tests pin that.
"""

import json
from decimal import Decimal

from app.models.business_settings import BusinessSettings
from app.models.customer import Customer
from app.services.loyalty_service import calculate_loyalty_discount
from tests.helpers import make_user
from tests.test_dashboard import _seed_customer


def _loyalty_settings(db_session, tiers):
    row = db_session.query(BusinessSettings).first()
    if row is None:
        row = BusinessSettings()
        db_session.add(row)
    row.loyalty_settings = json.dumps(
        {
            "enabled": True,
            "points_per_egp": 0.5,
            "redemption_rate": 0.1,
            "points_expiry_months": 3,
            "tiers": tiers,
        }
    )
    db_session.commit()
    db_session.refresh(row)
    return row


def _tiers():
    return [
        {"name": "برونزي", "min_visits": 1, "discount_percent": 10, "color": "bg-orange-600"},
        {"name": "فضي", "min_visits": 16, "discount_percent": 13, "color": "bg-amber-400"},
        {"name": "ذهبي", "min_visits": 20, "discount_percent": 15, "color": "bg-blue-500"},
    ]


def test_discount_uses_visits_not_the_stored_tier_name(db_session):
    make_user(db_session)
    _loyalty_settings(db_session, _tiers())

    customer = _seed_customer(db_session, phone="01001110000")
    customer.visits_count = 16
    # Legacy/foreign tier string: it matches no configured tier name.
    customer.current_tier = "Bronze"
    db_session.commit()

    discount = calculate_loyalty_discount(db_session, customer.customer_id, Decimal("200"))
    # 16 visits -> "فضي" -> 13% of 200
    assert discount == Decimal("26.000")


def test_a_renamed_tier_keeps_the_discount(db_session):
    make_user(db_session)
    _loyalty_settings(db_session, _tiers())

    customer = _seed_customer(db_session, phone="01001110001")
    customer.visits_count = 20
    customer.current_tier = "ذهبي"
    db_session.commit()

    # The owner renames the top tier; the stored string no longer matches.
    renamed = _tiers()
    renamed[2]["name"] = "النخبة"
    _loyalty_settings(db_session, renamed)

    discount = calculate_loyalty_discount(db_session, customer.customer_id, Decimal("200"))
    assert discount == Decimal("30.000")  # 15% of 200


def test_below_the_first_rung_gets_no_discount(db_session):
    """The ladder is authoritative, even when a stale tier name is stored.

    The first rung needs 1 visit, so a customer at 0 visits has no tier. The
    stored "برونزي" is legacy residue and must not resurrect a discount —
    honouring it is the exact silent-discount-loss this resolution removes.
    """
    make_user(db_session)
    _loyalty_settings(db_session, _tiers())

    customer = _seed_customer(db_session, phone="01001110002")
    customer.visits_count = 0
    customer.current_tier = "برونزي"
    db_session.commit()

    discount = calculate_loyalty_discount(db_session, customer.customer_id, Decimal("200"))
    assert discount == Decimal("0.00")


def test_disabled_loyalty_never_discounts(db_session):
    make_user(db_session)
    row = _loyalty_settings(db_session, _tiers())
    row.loyalty_settings = json.dumps({"enabled": False, "tiers": _tiers()})
    db_session.commit()

    customer = _seed_customer(db_session, phone="01001110003")
    customer.visits_count = 30
    customer.current_tier = "ذهبي"
    db_session.commit()

    discount = calculate_loyalty_discount(db_session, customer.customer_id, Decimal("200"))
    assert discount == Decimal("0.00")


def test_unknown_customer_is_not_a_discount(db_session):
    make_user(db_session)
    _loyalty_settings(db_session, _tiers())
    discount = calculate_loyalty_discount(db_session, 999999, Decimal("200"))
    assert discount == Decimal("0.00")
