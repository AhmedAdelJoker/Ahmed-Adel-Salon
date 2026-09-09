from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps_auth import get_current_active_user
from app.models.pos_shift import PosShift
from app.models.user import User
from app.core.roles import is_role_allowed


def require_roles(*allowed_roles):
    def dependency(current_user: User = Depends(get_current_active_user)):
        if not is_role_allowed(current_user.role, *allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ليس لديك صلاحية للوصول إلى هذا المورد",
            )
        return current_user

    return dependency


require_owner = require_roles("admin", "owner")
require_owner_or_manager = require_roles("admin", "owner", "manager", "accountant")
require_cashier_manager_owner = require_roles("cashier", "manager", "admin", "owner", "accountant")
require_any_staff = require_roles("cashier", "barber", "manager", "admin", "owner", "accountant")
require_barber_only = require_roles("barber")


def get_current_active_shift(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    own_shift = (
        db.query(PosShift)
        .filter(PosShift.user_id == current_user.id, PosShift.status == "open")
        .order_by(PosShift.id.desc())
        .first()
    )
    if own_shift:
        return own_shift

    if current_user.role in {"admin", "owner", "manager"}:
        fallback_shift = (
            db.query(PosShift)
            .filter(PosShift.status == "open")
            .order_by(PosShift.id.desc())
            .first()
        )
        if fallback_shift:
            return fallback_shift

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="لا توجد وردية مفتوحة حالياً. افتح وردية نقطة البيع أولاً.",
    )


def get_current_active_superuser(
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role not in {"admin", "owner"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ليس لديك صلاحية للوصول إلى هذا المورد",
        )
    return current_user
