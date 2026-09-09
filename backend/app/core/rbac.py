from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from functools import wraps
from typing import Callable

from fastapi import HTTPException, status

from app.core.roles import UserRole

ROLE_HIERARCHY = {
    UserRole.OWNER: 100,
    UserRole.ADMIN: 90,
    UserRole.ACCOUNTANT: 70,
    UserRole.MANAGER: 60,
    UserRole.CASHIER: 40,
    UserRole.BARBER: 20,
}

PERMISSION_MATRIX = {
    "view_dashboard": [UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER, UserRole.CASHIER],
    "view_owner_dashboard": [UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT],
    "view_manager_dashboard": [UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT],
    "view_cashier_dashboard": [UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "view_barber_dashboard": [UserRole.BARBER],

    "manage_users": [UserRole.OWNER, UserRole.ADMIN],
    "manage_barbers": [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER],
    "manage_services": [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER],
    "manage_business_settings": [UserRole.OWNER, UserRole.ADMIN],
    "view_audit_logs": [UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT],

    "create_invoice": [UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "apply_discount": [UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "approve_discount": [UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "close_shift": [UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "view_reports": [UserRole.ACCOUNTANT, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "view_commissions": [UserRole.ACCOUNTANT, UserRole.OWNER, UserRole.ADMIN],
    "audit_payroll": [UserRole.ACCOUNTANT, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "approve_payroll": [UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT],
    "pay_payroll": [UserRole.OWNER, UserRole.ADMIN],

    "manage_appointments": [UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "manage_walk_in_queue": [UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "manage_expenses": [UserRole.ACCOUNTANT, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN, UserRole.CASHIER],
    "manage_inventory": [UserRole.ACCOUNTANT, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN, UserRole.CASHIER],

    "start_session": [UserRole.BARBER, UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.ADMIN],
    "view_own_sessions": [UserRole.BARBER],
}


def has_permission(role: str, permission: str) -> bool:
    if not role:
        return False
    try:
        user_role = UserRole(role.lower())
    except ValueError:
        return False

    allowed = PERMISSION_MATRIX.get(permission, [])
    return user_role in allowed


def role_level(role: str) -> int:
    try:
        return ROLE_HIERARCHY.get(UserRole(role), 0)
    except ValueError:
        return 0


def can_access(target_role: str, current_role: str) -> bool:
    return role_level(current_role) >= role_level(target_role)



