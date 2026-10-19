"""Employee identity rules — phone, national id, names, money, duplicates.

What the wizard now refuses client-side must be refused here for real: these
tests go through the API, because the store is reachable without the wizard.
The two live rows this guards against read ``3000259548542`` (thirteen digits)
and ``30005849342594`` (an embedded day 84) — both accepted happily before this
existed.
"""
from app.models.employee import Employee
from tests.helpers import auth_headers, make_user


def _owner(client, db_session):
    make_user(db_session, username="owner1", role="owner")
    auth_headers(client, "owner1")  # token is cached per-session
    return auth_headers(client, "owner1")


def _payload(**overrides):
    data = {"fullName": "أحمد محمد علي", "phonePrimary": "01001234567"}
    data.update(overrides)
    return data


def _field(data, camel, snake):
    """EmployeeRead serializes camelCase; keep the assertion honest either way."""
    return data.get(camel, data.get(snake))


# ── Phone ────────────────────────────────────────────────────────────────────


def test_garbage_phone_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(phonePrimary="abc-def!"),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


def test_arabic_indic_phone_is_understood_and_normalized(client, db_session):
    """٠١٠١٢٣٤٥٦٧٨ is an Egyptian mobile; store it as 01012345678."""
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(phonePrimary="٠١٠١٢٣٤٥٦٧٨"),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert _field(resp.json(), "phonePrimary", "phone_primary") == "01012345678"


def test_too_many_phone_digits_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(phonePrimary="0100123456789012"),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


def test_egyptian_shaped_but_wrong_length_names_the_rule(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(phonePrimary="0101234567"),  # 10 digits, starts 01
        headers=headers,
    )
    assert resp.status_code == 422, resp.text
    assert "مصري" in resp.text


def test_required_phone_cannot_be_blank(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(phonePrimary="   "),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


def test_five_in_a_row_is_a_number_not_a_typo(client, db_session):
    """01000007777 is a real-shaped Egyptian mobile: a five-run is legitimate,
    and the repeated-digit rule must not reject it (it did, before the
    threshold was raised from four to six)."""
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(phonePrimary="01000007777"),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text


def test_six_repeats_is_still_a_typo(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(phonePrimary="01111111111"),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


# ── National id ──────────────────────────────────────────────────────────────


def test_thirteen_digit_national_id_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(nationalId="3000259548542"),  # the live bad row
        headers=headers,
    )
    assert resp.status_code == 422, resp.text
    assert "14" in resp.text


def test_impossible_embedded_birth_date_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(nationalId="30005849342594"),  # day 84, the other bad row
        headers=headers,
    )
    assert resp.status_code == 422, resp.text
    assert "تاريخ ميلاد" in resp.text


def test_valid_national_id_is_stored_as_digits(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(nationalId="٣٠٠٠١٠١٠١٢٣٤٥١"),  # Arabic numerals in
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert _field(resp.json(), "nationalId", "national_id") == "30001010123451"


def test_national_id_is_optional(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(nationalId=""),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text


# ── Names ────────────────────────────────────────────────────────────────────


def test_name_with_digits_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(fullName="أحمد 123"),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


def test_empty_name_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(fullName="  "),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


# ── Money and percentages ────────────────────────────────────────────────────


def test_negative_salary_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(baseSalary=-100),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


def test_commission_above_hundred_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(commissionRate=150),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


# ── Login account fields ─────────────────────────────────────────────────────


def test_arabic_username_is_rejected_when_creating_an_account(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(
            hasLoginAccount=True,
            username="أحمد",
            password="Barber2026",
        ),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


def test_garbage_wallet_number_is_rejected(client, db_session):
    headers = _owner(client, db_session)
    resp = client.post(
        "/api/v1/employees",
        json=_payload(walletNumber="xyz"),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


# ── Duplicates: 409, with the holder's name ──────────────────────────────────


def test_duplicate_phone_conflicts_with_409(client, db_session):
    headers = _owner(client, db_session)
    first = client.post("/api/v1/employees", json=_payload(), headers=headers)
    assert first.status_code == 201, first.text

    second = client.post(
        "/api/v1/employees",
        json=_payload(fullName="محمد سامي"),
        headers=headers,
    )
    assert second.status_code == 409, second.text
    assert "أحمد محمد علي" in second.json()["detail"]


def test_duplicate_national_id_conflicts_with_409(client, db_session):
    headers = _owner(client, db_session)
    first = client.post(
        "/api/v1/employees",
        json=_payload(nationalId="30001010123451"),
        headers=headers,
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/api/v1/employees",
        json=_payload(
            fullName="محمد سامي",
            phonePrimary="01098765432",
            nationalId="30001010123451",
        ),
        headers=headers,
    )
    assert second.status_code == 409, second.text
    assert "رقم الهوية" in second.json()["detail"]


def test_update_cannot_take_a_number_held_by_someone_else(client, db_session):
    headers = _owner(client, db_session)
    first = client.post("/api/v1/employees", json=_payload(), headers=headers)
    assert first.status_code == 201, first.text

    second = client.post(
        "/api/v1/employees",
        json=_payload(fullName="محمد سامي", phonePrimary="01098765432"),
        headers=headers,
    )
    assert second.status_code == 201, second.text
    second_id = second.json()["id"]

    resp = client.put(
        f"/api/v1/employees/{second_id}",
        json={"phonePrimary": "01001234567"},
        headers=headers,
    )
    assert resp.status_code == 409, resp.text


def test_partial_update_without_identity_fields_still_works(client, db_session):
    """A missing phone in an update means "keep it", not "required"."""
    headers = _owner(client, db_session)
    created = client.post("/api/v1/employees", json=_payload(), headers=headers)
    assert created.status_code == 201, created.text
    emp_id = created.json()["id"]

    resp = client.put(
        f"/api/v1/employees/{emp_id}",
        json={"city": "القاهرة"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert _field(resp.json(), "phonePrimary", "phone_primary") == "01001234567"


# ── Search by national id ────────────────────────────────────────────────────


def test_roster_search_finds_by_national_id(client, db_session):
    headers = _owner(client, db_session)
    db_session.add(
        Employee(
            full_name="أحمد محمد",
            phone_primary="01001234567",
            national_id="30001010123451",
            job_title="barber",
            status="active",
        )
    )
    db_session.commit()

    resp = client.get(
        "/api/v1/employees",
        params={"q": "30001010123451"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert [e["full_name"] for e in resp.json()] == ["أحمد محمد"]
