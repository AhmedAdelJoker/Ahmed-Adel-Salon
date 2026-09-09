from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.models.business_settings import BusinessSettings
from decimal import Decimal
import json

def get_loyalty_settings(db: Session):
    settings = db.query(BusinessSettings).first()
    if settings and settings.loyalty_settings:
        if isinstance(settings.loyalty_settings, str):
            return json.loads(settings.loyalty_settings)
        return settings.loyalty_settings
    return None

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

    # 2. Add Points
    points_per_egp = Decimal(str(settings.get("points_per_egp", 0.1)))
    new_points = amount_paid * points_per_egp
    customer.loyalty_points += new_points

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
