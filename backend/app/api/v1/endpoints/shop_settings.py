from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_owner, require_owner_or_manager
from app.crud.core_business import create_audit_log, get_shop_settings, update_shop_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.core_business import ShopSettingsBase, ShopSettingsOut

router = APIRouter(prefix="/shop-settings", tags=["shop-settings"])


@router.get("/", response_model=ShopSettingsOut)
def read_shop_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    return get_shop_settings(db)


@router.put("/", response_model=ShopSettingsOut)
def update_settings(
    payload: ShopSettingsBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    old = get_shop_settings(db)
    values = payload.model_dump(exclude_unset=True)
    old_values = {
        key: getattr(old, key)
        for key in values
        if hasattr(old, key)
    }
    updated = update_shop_settings(db, values)
    create_audit_log(
        db,
        action="SHOP_SETTINGS_UPDATED",
        entity_name="shop_settings",
        entity_id=str(updated.id),
        user_id=current_user.id,
        user_name=current_user.full_name or current_user.username,
        old_values=old_values,
        new_values=values,
    )
    return updated
