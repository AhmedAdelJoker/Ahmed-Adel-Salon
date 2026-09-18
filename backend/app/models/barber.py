"""
Backward-compatibility alias — Phase 2 cleanup.

The legacy `Barber` model has been replaced by `Employee`. This module
exposes `Barber` as an alias of `Employee` so the 7 import sites still work
without code changes. New code should import `Employee` directly.
"""
from app.models.employee import Employee

# Re-export so `from app.models.barber import Barber` keeps working.
Barber = Employee

__all__ = ["Barber", "Employee"]
