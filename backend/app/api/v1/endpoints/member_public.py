from datetime import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import require_owner_or_manager
from app.db.session import get_db
from app.core.rate_limit import rate_limit
from app.core.security import (
    dummy_hash,
    create_member_access_token,
    decode_token,
    get_password_hash,
    is_jti_revoked,
    revoke_jti,
    token_version_of,
    validate_password_strength,
    verify_and_maybe_rehash,
)
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.member_account import MemberAccount
from app.models.user import User
from app.schemas.member import (
    MemberAuthResponse,
    MemberBookingRead,
    MemberLogin,
    MemberRegister,
    MemberUserRead,
)

router = APIRouter(prefix="/public", tags=["Public Member"])
logger = logging.getLogger(__name__)
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
        .options(joinedload(Customer.member_account))
        .filter(Customer.customer_id == customer_id)
        .first()
    )
    account = customer.member_account if customer else None
    if customer is None or customer.is_deleted or account is None or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="حساب العميل غير متاح",
        )
    if int(payload.get("ver", -1)) != token_version_of(account):
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

    db.add(customer)
    db.flush()
    account = MemberAccount(
        customer_id=customer.customer_id,
        password_hash=get_password_hash(payload.password),
        token_version=0,
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(customer)
    db.refresh(account)

    token = create_member_access_token(
        customer.customer_id,
        token_version_of(account),
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
    row = (
        db.query(Customer)
        .options(joinedload(Customer.member_account))
        .filter(func.lower(Customer.email) == email)
        .order_by(Customer.customer_id.asc())
        .first()
    )
    account = row.member_account if row else None
    password_hash = account.password_hash if account else dummy_hash()
    # The dummy hash keeps the timing indistinguishable between "no such
    # account" and "wrong password", so the verification runs either way.
    verified, upgraded_hash = verify_and_maybe_rehash(payload.password, password_hash)
    if not row or not verified or row.is_deleted or account is None or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="البريد الإلكتروني أو كلمة المرور غير صحيحة",
        )

    if upgraded_hash:
        # Same transparent upgrade as the staff login path: a member whose
        # credential predates Argon2id is upgraded on their next sign-in.
        account.password_hash = upgraded_hash
        db.commit()
        logger.info(
            "Upgraded member credential hash to Argon2id for customer_id=%s",
            row.customer_id,
        )

    token = create_member_access_token(
        row.customer_id,
        token_version_of(account),
    )
    return MemberAuthResponse(
        token=token,
        user=_member_user(row, db),
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


# --------------------------------------------------------------------------- staff-side account control


class MemberAccountStateRead(BaseModel):
    customer_id: int
    has_account: bool
    is_active: bool = False
    token_version: int = 0
    is_archived: bool = False
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@router.get("/member/{customer_id}/account", response_model=MemberAccountStateRead)
def read_member_account(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """Staff view of a customer's public-booking account."""
    customer = (
        db.query(Customer).filter(Customer.customer_id == customer_id).first()
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    account = customer.member_account
    return MemberAccountStateRead(
        customer_id=customer_id,
        has_account=account is not None,
        is_active=bool(account.is_active) if account else False,
        token_version=int(account.token_version or 0) if account else 0,
        is_archived=bool(customer.is_deleted),
        last_login_at=account.last_login_at if account else None,
        created_at=account.created_at if account else None,
    )


@router.post("/member/{customer_id}/account/deactivate")
def deactivate_member_account(
    customer_id: int,
    reason: str = Body("", embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """Revoke the public login and kill every live member session.

    Bumping ``token_version`` is what actually kills the sessions: every member
    token embeds the version it was minted with, and the auth dependency rejects
    any mismatch. The denylist is keyed by JWT id and cannot be swept by
    customer, so the version counter is the right lever.
    """
    from app.models.activity_log import ActivityLog

    account = (
        db.query(MemberAccount).filter(MemberAccount.customer_id == customer_id).first()
    )
    if account is None:
        raise HTTPException(
            status_code=404, detail="لا يوجد حساب عام لهذا العميل"
        )
    if not account.is_active:
        raise HTTPException(status_code=400, detail="الحساب معطّل بالفعل")

    account.is_active = False
    account.token_version = int(account.token_version or 0) + 1
    db.add(
        ActivityLog(
            user_id=current_user.id,
            action="deactivate_member_account",
            entity_type="member_account",
            entity_id=customer_id,
            description=f"تعطيل حساب العميل العام رقم {customer_id}"
            + (f" — السبب: {reason}" if reason else ""),
        )
    )
    db.commit()
    return {"message": "تم تعطيل الحساب العام وإنهاء جلساته"}


@router.post("/member/{customer_id}/account/activate")
def activate_member_account(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """Re-enable a public login. Refused while the customer is archived."""
    from app.models.activity_log import ActivityLog

    customer = (
        db.query(Customer).filter(Customer.customer_id == customer_id).first()
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    if customer.is_deleted:
        raise HTTPException(
            status_code=400,
            detail="العميل في الأرشيف — استعده أولاً قبل تفعيل الحساب",
        )

    account = (
        db.query(MemberAccount).filter(MemberAccount.customer_id == customer_id).first()
    )
    if account is None:
        raise HTTPException(
            status_code=404, detail="لا يوجد حساب عام لهذا العميل"
        )
    if account.is_active:
        raise HTTPException(status_code=400, detail="الحساب مفعّل بالفعل")

    account.is_active = True
    account.token_version = int(account.token_version or 0) + 1
    db.add(
        ActivityLog(
            user_id=current_user.id,
            action="activate_member_account",
            entity_type="member_account",
            entity_id=customer_id,
            description=f"إعادة تفعيل حساب العميل العام رقم {customer_id}",
        )
    )
    db.commit()
    return {"message": "تم تفعيل الحساب العام"}


@router.delete("/member/{customer_id}/account")
def delete_member_account(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """Remove the public login entirely, keeping the customer record intact."""
    from app.models.activity_log import ActivityLog

    account = (
        db.query(MemberAccount).filter(MemberAccount.customer_id == customer_id).first()
    )
    if account is None:
        raise HTTPException(
            status_code=404, detail="لا يوجد حساب عام لهذا العميل"
        )
    db.delete(account)
    db.add(
        ActivityLog(
            user_id=current_user.id,
            action="delete_member_account",
            entity_type="member_account",
            entity_id=customer_id,
            description=f"حذف حساب العميل العام رقم {customer_id}",
        )
    )
    db.commit()
    return {"message": "تم حذف الحساب العام"}
