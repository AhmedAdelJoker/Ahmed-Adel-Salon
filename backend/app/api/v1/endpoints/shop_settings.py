from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.schemas.core_business import ShopSettingsBase, ShopSettingsOut
from app.crud.core_business import get_shop_settings, update_shop_settings, create_audit_log

router = APIRouter(prefix="/shop-settings", tags=["shop-settings"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=ShopSettingsOut)
def read_shop_settings(db: Session = Depends(get_db)):
    return get_shop_settings(db)


@router.put("/", response_model=ShopSettingsOut)
def update_settings(payload: ShopSettingsBase, db: Session = Depends(get_db)):
    old = get_shop_settings(db)
    updated = update_shop_settings(db, payload.dict(exclude_unset=True))

    create_audit_log(
        db,
        action="SHOP_SETTINGS_UPDATED",
        entity_name="shop_settings",
        entity_id="1",
        old_values={"shop_name": old.shop_name},
        new_values=payload.dict(exclude_unset=True),
    )

    return updated



