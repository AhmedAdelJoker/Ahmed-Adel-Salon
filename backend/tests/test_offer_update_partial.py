"""Updating an offer must not silently destroy it.

`PUT /offers/{id}` wiped `is_public`, `is_active`, `service_ids` and
`products` whenever the caller left them out, because each one has a default
that is indistinguishable from "not sent" once the payload is validated. The
public offer form edits the services and neither of the two flags, so saving an
offer from the catalog tab:

  - removed every service from it — after a form that validates "pick at least
    one service" and then throws that selection away, and
  - forced `is_public` and `is_active` back to their `True` defaults, so an
    unpublished or disabled offer came back live on the public site.

An absent key now means "leave it alone", the way `PUT /employees/{id}` and
`PUT /business-settings` already behave.
"""
from datetime import date, timedelta
from decimal import Decimal

from app.models.offer import Offer
from app.models.offer_product import OfferProduct
from app.models.offer_service import OfferService
from app.models.product import Product
from app.models.service import Service
from tests.helpers import auth_headers, make_user


def _owner(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    return auth_headers(client, "owner1")


def _seed_offer(db_session, **overrides):
    offer = Offer(
        name="باقة الشعر",
        name_ar="باقة الشعر",
        offer_price=Decimal("100"),
        original_price=Decimal("200"),
        is_active=True,
        is_public=False,  # unpublished on purpose
        start_date=date.today() - timedelta(days=1),
        end_date=date.today() + timedelta(days=10),
    )
    for key, value in overrides.items():
        setattr(offer, key, value)
    db_session.add(offer)
    db_session.commit()
    return offer


def _link(db_session, offer, service, product):
    db_session.add(OfferService(offer_id=offer.id, service_id=service.id))
    db_session.add(
        OfferProduct(offer_id=offer.id, product_id=product.id, quantity=Decimal("2"))
    )
    db_session.commit()


def test_an_update_that_omits_the_links_keeps_them(client, db_session):
    headers = _owner(client, db_session)
    service = Service(name="حلاقة", price=Decimal("50"), duration_minutes=30)
    product = Product(name="واكس", quantity=Decimal("10"), sell_price=Decimal("40"))
    db_session.add_all([service, product])
    db_session.commit()

    offer = _seed_offer(db_session)
    _link(db_session, offer, service, product)

    resp = client.put(
        f"/api/v1/offers/{offer.id}",
        json={"name": "اسم جديد", "offer_price": 90},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert [s["id"] for s in body["services"]] == [service.id]
    assert [p["product_id"] for p in body["offer_products"]] == [product.id]


def test_an_update_that_omits_the_flags_keeps_them(client, db_session):
    """The offer stays unpublished and the dates stay as the owner set them."""
    headers = _owner(client, db_session)
    offer = _seed_offer(db_session, is_active=False)

    resp = client.put(
        f"/api/v1/offers/{offer.id}",
        json={"name": "عرض معطل", "offer_price": 80},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    assert resp.json()["is_public"] is False
    assert resp.json()["is_active"] is False


def test_an_explicit_empty_service_list_still_clears_the_services(client, db_session):
    """Partial semantics must not make the field impossible to empty."""
    headers = _owner(client, db_session)
    service = Service(name="حلاقة", price=Decimal("50"), duration_minutes=30)
    db_session.add(service)
    db_session.commit()

    offer = _seed_offer(db_session)
    db_session.add(OfferService(offer_id=offer.id, service_id=service.id))
    db_session.commit()

    resp = client.put(
        f"/api/v1/offers/{offer.id}",
        json={"name": "بدون خدمات", "offer_price": 50, "service_ids": []},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["services"] == []


def test_the_public_catalog_still_hides_an_unpublished_offer(client, db_session):
    _owner(client, db_session)
    offer = _seed_offer(db_session, is_public=False, is_active=True)
    client.post("/api/v1/business-settings/publish-site", headers=auth_headers(client, "owner1"))

    ids = [o["id"] for o in client.get("/api/v1/public/booking-catalog").json()["offers"]]
    assert offer.id not in ids
