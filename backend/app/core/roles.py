from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    CASHIER = "cashier"
    BARBER = "barber"


ROLE_ALIASES = {
    "owner": UserRole.ADMIN.value,
    "admin": UserRole.ADMIN.value,
    "manager": UserRole.MANAGER.value,
    "cashier": UserRole.CASHIER.value,
    "barber": UserRole.BARBER.value,
}


def normalize_role(role: str | None) -> str:
    if role is None:
        return ""
    return ROLE_ALIASES.get(str(role).strip().lower(), str(role).strip().lower())


def is_role_allowed(role: str | None, *allowed_roles: str) -> bool:
    normalized_role = normalize_role(role)
    normalized_allowed = {normalize_role(item) for item in allowed_roles}
    return normalized_role in normalized_allowed
