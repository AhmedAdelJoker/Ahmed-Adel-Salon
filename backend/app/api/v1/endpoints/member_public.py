from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.session import get_db
from app.core.rate_limit import rate_limit
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_member_access_token,
    decode_token,
    get_password_hash,
    is_jti_revoked,
    revoke_jti,
    token_version_of,
    validate_password_strength,
    verify_password,
)
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.schemas.member import (
    MemberAuthResponse,
    MemberBookingRead,
    MemberLogin,
    MemberRegister,
    MemberUserRead,
)

router = APIRouter(prefix="/public", tags=["Public Member"])
bearer_scheme = HTTPBearer(auto_error=False)
member_auth_rate_limit = rate_limit(
    "public_member_auth",
    max_requests=10,
    window_seconds=60,
)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _split_name(name: str) -> tuple[str, str]:
    parts = name.strip().split(None, 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def _member_from_credentials(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
) -> Customer:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="تسجيل الدخول مطلوب",
        )

    try:
        payload = decode_token(credentials.credentials, expected_type="member_access")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="جلسة العميل غير صالحة",
        ) from exc

    if payload.get("scope") != "member":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="جلسة العميل غير صالحة",
        )
    if is_jti_revoked(db, payload.get("jti")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="انتهت صلاحية جلسة العميل",
        )

    subject = str(payload.get("sub") or "")
    try:
        customer_id = int(subject.split(":", 1)[1])
    except (IndexError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="جلسة العميل غير صالحة",
        ) from exc

    customer = (
        db.query(Customer)
        .filter(Customer.customer_id == customer_id)
        .first()
    )
    if customer is None or customer.is_deleted or not customer.member_password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="حساب العميل غير متاح",
        )
    if int(payload.get("ver", -1)) != token_version_of(customer):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="انتهت صلاحية جلسة العميل",
        )
    return customer


def get_current_member(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Customer:
    return _member_from_credentials(credentials, db)


def get_optional_member(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Customer | None:
    if credentials is None:
        return None
    try:
        return _member_from_credentials(credentials, db)
    except HTTPException:
        return None


def _member_user(
    customer: Customer,
    db: Session,
    bookings_count: int | None = None,
) -> MemberUserRead:
    if bookings_count is None:
        bookings_count = (
            db.query(func.count(Appointment.id))
            .filter(Appointment.customer_id == customer.customer_id)
            .scalar()
            or 0
        )
    name = " ".join(
        part for part in (customer.first_name, customer.last_name) if part
    ).strip()
    return MemberUserRead(
        id=customer.customer_id,
        name=name or "عميل",
        email=_normalize_email(customer.email or ""),
        phone=customer.phone,
        loyaltyPoints=float(customer.loyalty_points or 0),
        bookingsCount=int(bookings_count),
    )


@router.post(
    "/member/register",
    response_model=MemberAuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(member_auth_rate_limit)],
)
def register_member(
    payload: MemberRegister,
    db: Session = Depends(get_db),
) -> MemberAuthResponse:
    try:
        validate_password_strength(payload.password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    email = _normalize_email(payload.email)
    customer = (
        db.query(Customer)
        .filter(func.lower(Customer.email) == email)
        .order_by(Customer.customer_id.asc())
        .first()
    )
    if customer is None:
        customer = (
            db.query(Customer)
            .filter(Customer.phone == payload.phone)
            .order_by(Customer.customer_id.asc())
            .first()
        )

    if customer is not None:
        if customer.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="لا يمكن إنشاء حساب لهذا العميل",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="بيانات التواصل مستخدمة بالفعل، يرجى التواصل مع الصالون لتفعيل الحساب",
        )

    first_name, last_name = _split_name(payload.name)
    customer = Customer(
        first_name=first_name,
        last_name=last_name,
        phone=payload.phone,
        email=email,
    )

    customer.member_password_hash = get_password_hash(payload.password)
    customer.member_token_version = token_version_of(customer) + 1
    db.add(customer)
    db.commit()
    db.refresh(customer)

    token = create_member_access_token(
        customer.customer_id,
        token_version_of(customer),
    )
    return MemberAuthResponse(
        token=token,
        user=_member_user(customer, db),
    )


@router.post(
    "/member/login",
    response_model=MemberAuthResponse,
    dependencies=[Depends(member_auth_rate_limit)],
)
def login_member(
    payload: MemberLogin,
    db: Session = Depends(get_db),
) -> MemberAuthResponse:
    email = _normalize_email(payload.email)
    customer = (
        db.query(Customer)
        .filter(func.lower(Customer.email) == email)
        .order_by(Customer.customer_id.asc())
        .first()
    )
    password_hash = customer.member_password_hash if customer else DUMMY_PASSWORD_HASH
    try:
        valid = verify_password(payload.password, password_hash)
    except Exception:
        valid = False
    if not customer or not valid or customer.is_deleted or not customer.member_password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="البريد الإلكتروني أو كلمة المرور غير صحيحة",
        )

    token = create_member_access_token(
        customer.customer_id,
        token_version_of(customer),
    )
    return MemberAuthResponse(
        token=token,
        user=_member_user(customer, db),
    )


@router.get("/member/me", response_model=MemberUserRead)
def read_member(
    customer: Customer = Depends(get_current_member),
    db: Session = Depends(get_db),
) -> MemberUserRead:
    return _member_user(customer, db)


@router.get("/member/bookings", response_model=list[MemberBookingRead])
def list_member_bookings(
    customer: Customer = Depends(get_current_member),
    db: Session = Depends(get_db),
) -> list[MemberBookingRead]:
    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.barber), selectinload(Appointment.services))
        .filter(Appointment.customer_id == customer.customer_id)
        .order_by(
            Appointment.appointment_date.desc(),
            Appointment.appointment_time.desc(),
        )
        .limit(100)
        .all()
    )
    result = []
    for appointment in appointments:
        service_name = next(
            (
                service.service_name_snapshot
                for service in appointment.services
                if service.is_active and service.service_name_snapshot
            ),
            "خدمة",
        )
        barber_name = None
        if appointment.barber is not None:
            barber_name = appointment.barber.display_name or appointment.barber.full_name
        result.append(
            MemberBookingRead(
                id=appointment.id,
                status=appointment.status,
                scheduledAt=datetime.combine(
                    appointment.appointment_date,
                    appointment.appointment_time,
                ),
                serviceName=service_name,
                barberName=barber_name,
            )
        )
    return result


@router.post("/member/logout")
def logout_member(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    customer: Customer = Depends(get_current_member),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if credentials is not None:
        try:
            payload = decode_token(
                credentials.credentials,
                expected_type="member_access",
            )
            revoke_jti(
                db,
                payload.get("jti"),
                token_type="member_access",
                reason="logout",
            )
            db.commit()
        except Exception:
            db.rollback()
    return {"message": "تم تسجيل الخروج بنجاح"}
