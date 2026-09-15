from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.models.business_settings import BusinessSettings
from decimal import Decimal
from datetime import datetime, timedelta
import json


def _normalize_loyalty_settings(raw):
    """يوحّد مفاتيح snake/camel المحفوظة في عمود JSON ويؤمّن القيم قبل الحساب.

    عمود loyalty_settings حرة التخزين، وواجهات قديمة قد تكون حفظت camelCase
    (pointsPerEgp) — القراءة هنا يجب أن تتقبل الاثنين.
    """
    if not isinstance(raw, dict):
        return None

    def _num(*keys, default):
        for key in keys:
            try:
                if raw.get(key) is not None:
                    return float(raw[key])
            except (TypeError, ValueError):
                continue
        return default

    tiers = raw.get("tiers") if isinstance(raw.get("tiers"), list) else []
    normalized_tiers = []
    for tier in tiers:
        if not isinstance(tier, dict):
            continue
        try:
            min_visits = max(0, int(float(tier.get("min_visits", tier.get("minVisits", 0)) or 0)))
        except (TypeError, ValueError):
            min_visits = 0
        try:
            discount = min(100.0, max(0.0, float(tier.get("discount_percent", tier.get("discountPercent", 0)) or 0)))
        except (TypeError, ValueError):
            discount = 0.0
        normalized_tiers.append(
            {
                "name": str(tier.get("name", "")).strip(),
                "min_visits": min_visits,
                "discount_percent": discount,
                "color": tier.get("color") or "bg-accent",
            }
        )

    enabled = raw.get("enabled")
    try:
        expiry_months = min(
            120,
            max(0, int(float(raw.get("points_expiry_months", raw.get("pointsExpiryMonths", 0)) or 0))),
        )
    except (TypeError, ValueError):
        expiry_months = 0

    return {
        "enabled": enabled is True or str(enabled).lower() == "true",
        "points_per_egp": _num("points_per_egp", "pointsPerEgp", default=0.1),
        "redemption_rate": _num("redemption_rate", "redemptionRate", default=0.5),
        "points_expiry_months": expiry_months,
        "tiers": normalized_tiers,
    }


def get_loyalty_settings(db: Session):
    settings = db.query(BusinessSettings).first()
    if settings and settings.loyalty_settings:
        raw = settings.loyalty_settings
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (TypeError, ValueError):
                return None
        return _normalize_loyalty_settings(raw)
    return None


def _points_cutoff(months: int) -> datetime:
    return datetime.utcnow() - timedelta(days=30 * months)


def _expire_stale_points(customer: Customer, cutoff: datetime) -> bool:
    """تصفير رصيد عميل واحد إذا انتهت صلاحيته — المدة تُحسب من آخر كسب للنقاط.

    الأرصدة المكتسبة قبل إضافة عمود تاريخ الكسب (بلا تاريخ) تُعتبر صالحة
    حتى أول كسب جديد يثبّت بداية العد، كي لا نصفر أرصدة قائمة فجأة.
    """
    if not customer.loyalty_points or not customer.loyalty_points_earned_at:
        return False
    try:
        stale = customer.loyalty_points_earned_at < cutoff
    except TypeError:
        # خلط تواريخ naive/aware — نتجنب التصفير احتياطاً
        return False
    if stale:
        customer.loyalty_points = 0
        customer.loyalty_points_earned_at = None
        return True
    return False


def sweep_expired_points(db: Session, customers) -> bool:
    """مسح أرصدة النقاط المنتهية قبل عرضها في مسارات قراءة العملاء.

    يعيد True إذا تغيّر رصيد واحد على الأقل — على المتصل عمل commit.
    """
    if not customers:
        return False
    settings = get_loyalty_settings(db) or {}
    months = int(settings.get("points_expiry_months", 0) or 0)
    if months <= 0:
        return False
    cutoff = _points_cutoff(months)
    changed = False
    for customer in customers:
        if _expire_stale_points(customer, cutoff):
            changed = True
    return changed


def update_customer_loyalty(db: Session, customer_id: int, amount_paid: Decimal):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        return

    settings = get_loyalty_settings(db)
    if not settings or not settings.get("enabled"):
        # Even if loyalty system is disabled, we still track spend and visits for future use
        customer.lifetime_spend += amount_paid
        customer.visits_count += 1
        return

    # 1. Update Spend and Visits
    customer.lifetime_spend += amount_paid
    customer.visits_count += 1

    # 2. Expire stale balance first, then earn fresh points — validity refreshes on every earn
    months = int(settings.get("points_expiry_months", 0) or 0)
    if months > 0:
        _expire_stale_points(customer, _points_cutoff(months))
    points_per_egp = Decimal(str(settings.get("points_per_egp", 0.1)))
    new_points = amount_paid * points_per_egp
    customer.loyalty_points += new_points
    customer.loyalty_points_earned_at = datetime.utcnow()

    # 3. Update Tier
    tiers = settings.get("tiers", [])
    # Sort tiers by min_visits descending to find the highest reached
    sorted_tiers = sorted(tiers, key=lambda x: x.get("min_visits", 0), reverse=True)

    for tier in sorted_tiers:
        if customer.visits_count >= tier.get("min_visits", 0):
            customer.current_tier = tier.get("name", "Bronze")
            break

    db.add(customer)
    # Note: We don't commit here, the caller should commit


def calculate_loyalty_discount(db: Session, customer_id: int, current_total: Decimal) -> Decimal:
    """Calculates the discount based on the customer's current tier."""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        return Decimal("0.00")

    settings = get_loyalty_settings(db)
    if not settings or not settings.get("enabled"):
        return Decimal("0.00")

    tiers = settings.get("tiers", [])
    discount_percent = 0

    for tier in tiers:
        if tier.get("name") == customer.current_tier:
            discount_percent = tier.get("discount_percent", 0)
            break

    if discount_percent > 0:
        return (current_total * Decimal(str(discount_percent))) / Decimal("100")

    return Decimal("0.00")
