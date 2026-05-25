from fastapi import Depends, HTTPException, status

from app.db.session import get_db
from app.api.deps_auth import get_current_active_user
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
require_owner_or_manager = require_roles("admin", "owner", "manager")
require_cashier_manager_owner = require_roles("cashier", "manager", "admin", "owner")
require_any_staff = require_roles("cashier", "barber", "manager", "admin", "owner")
require_barber_only = require_roles("barber")
