from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.business_settings import BusinessSettings
from app.schemas.business_settings import BusinessSettingsRead, BusinessSettingsUpdate

router = APIRouter(prefix="/business-settings", tags=["Business Settings"])


def _get_or_create_business_settings(db: Session) -> BusinessSettings:
    row = db.query(BusinessSettings).first()

    if row:
        # تأكد أن currency دائمًا لها قيمة
        if not getattr(row, "currency", None):
            row.currency = "EGP"
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    row = BusinessSettings(
        salon_name="SalonPro",
        shop_phone=None,
        shop_whatsapp=None,
        address=None,
        receipt_footer=None,
        currency="EGP",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=BusinessSettingsRead)
def read_business_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    return _get_or_create_business_settings(db)


@router.put("", response_model=BusinessSettingsRead)
def update_business_settings(
    payload: BusinessSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    row = _get_or_create_business_settings(db)

    if payload.salon_name is not None:
        row.salon_name = payload.salon_name
    if payload.shop_phone is not None:
        row.shop_phone = payload.shop_phone
    if payload.shop_whatsapp is not None:
        row.shop_whatsapp = payload.shop_whatsapp
    if payload.address is not None:
        row.address = payload.address
    if payload.receipt_footer is not None:
        row.receipt_footer = payload.receipt_footer
    if payload.currency is not None:
        row.currency = payload.currency

    db.add(row)
    db.commit()
    db.refresh(row)
    return row