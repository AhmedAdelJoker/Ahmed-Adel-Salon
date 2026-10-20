"""What the public booking catalog is allowed to expose.

All four checks below are about the gap between "this row exists" and "the
public site is entitled to see it". The catalog is unauthenticated, so every
predicate here is a publication decision that gets no second chance.
"""
from datetime import date, timedelta

from app.models.business_settings import BusinessSettings
from app.models.employee import Employee
from app.models.offer import Offer
from app.models.service import Service
from tests.helpers import auth_headers, make_user


def _publish(client, db_session):
    """Publish the site so the catalog's publish gate opens."""
    make_user(db_session, username="owner1", role="owner")
    headers = auth_headers(client, "owner1")
    client.post("/api/v1/business-settings/publish-site", headers=headers)


def test_only_service_providers_are_offered_to_the_public(client, db_session):
    """`show_in_booking` defaults to True, so the flag alone is not a gate.

    Who may be booked online is a classification: every service-providing
    title — barber, colorist, esthetician — is offered when the owner's switch
    is on, while an accountant, cashier, manager, receptionist or unlinked
    assistant never is. The job-title filter is the one that keeps admin staff
    off the public site.
    """
    _publish(client, db_session)

    providers = [
        ("حلاق", "barber", "01000000001"),
        ("خبير صبغة", "colorist", "01000000003"),
        ("أخصائي بشرة", "esthetician", "01000000004"),
    ]
    for name, title, phone in providers:
        db_session.add(
            Employee(
                full_name=name,
                phone_primary=phone,
                job_title=title,
                is_active=True,
                show_in_booking=True,
                status="active",
            )
        )
    never_public = [
        ("موظف كاشير", "cashier", "01000000011"),
        ("محاسب", "accountant", "01000000012"),
        ("مدير", "manager", "01000000013"),
        ("سفير خدمة", "receptionist", "01000000014"),
        ("مساعد فني", "barber_assistant", "01000000015"),
    ]
    for name, title, phone in never_public:
        db_session.add(
            Employee(
                full_name=name,
                phone_primary=phone,
                job_title=title,
                is_active=True,
                show_in_booking=True,
                status="active",
            )
        )
    db_session.commit()

    barbers = client.get("/api/v1/public/booking-catalog").json()["barbers"]
    assert sorted(b["display_name"] for b in barbers) == sorted(
        name for name, _, _ in providers
    )


def test_on_vacation_and_resigned_employees_are_not_bookable(client, db_session):
    """`is_active` says the row is usable; `status` says this person is not.

    A vacationing employee keeps `is_active=True` on purpose (the team list
    shows them with a badge), and a leaver may too — both must be absent from
    the public catalog. `status` is what keeps yesterday's roster out of
    today's calendar.
    """
    _publish(client, db_session)

    db_session.add(
        Employee(
            full_name="حلاق في إجازة",
            phone_primary="01000000009",
            job_title="barber",
            is_active=True,
            show_in_booking=True,
            status="suspended",
        )
    )
    db_session.add(
        Employee(
            full_name="حلاق مستقيل",
            phone_primary="01000000010",
            job_title="barber",
            is_active=True,
            show_in_booking=True,
            status="resigned",
        )
    )
    db_session.commit()

    barbers = client.get("/api/v1/public/booking-catalog").json()["barbers"]
    assert barbers == []


def test_an_expired_offer_is_not_advertised(client, db_session):
    """The date window on `/offers/active` was never applied to the catalog.

    An offer whose window had ended kept being served, so the site advertised a
    price the salon no longer honoured.
    """
    _publish(client, db_session)

    today = date.today()
    db_session.add(
        Offer(
            name="عرض منتهي",
            name_ar="عرض منتهي",
            offer_price=100,
            original_price=200,
            is_active=True,
            is_public=True,
            end_date=today - timedelta(days=1),
        )
    )
    db_session.add(
        Offer(
            name="عرض جاري",
            name_ar="عرض جاري",
            offer_price=100,
            original_price=200,
            is_active=True,
            is_public=True,
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=1),
        )
    )
    db_session.commit()

    offers = client.get("/api/v1/public/booking-catalog").json()["offers"]
    assert [o["name"] for o in offers] == ["عرض جاري"]


def test_a_private_offer_is_never_public(client, db_session):
    _publish(client, db_session)
    db_session.add(
        Offer(
            name="عرض داخلي",
            name_ar="عرض داخلي",
            offer_price=50,
            original_price=100,
            is_active=True,
            is_public=False,
        )
    )
    db_session.commit()

    assert client.get("/api/v1/public/booking-catalog").json()["offers"] == []


def test_the_catalog_is_reachable_without_a_token_but_404_when_unpublished(client, db_session):
    """Publication is a decision, not an accident of the data existing."""
    row = BusinessSettings(salon_name="SalonPro", currency="EGP")
    db_session.add(row)
    db_session.commit()

    assert client.get("/api/v1/public/booking-catalog").status_code == 404

    _publish(client, db_session)
    assert client.get("/api/v1/public/booking-catalog").status_code == 200
