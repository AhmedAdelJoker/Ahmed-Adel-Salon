from app.db.session import SessionLocal
import app.db.base  # This will import all models
from app.models.user import User
from app.models.business_settings import BusinessSettings
from app.models.employee import Employee
from app.models.service import Service
from app.models.service_category import ServiceCategory
from app.models.product import Product
from app.models.expense import Expense
from app.core.security import get_password_hash
from decimal import Decimal


def seed_data():
    db = SessionLocal()

    try:
        # ✅ Admin & Accountant
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                hashed_password=get_password_hash("252525"),
                full_name="المالك (Principal Owner)",
                role="owner",
                is_active=True
            )
            db.add(admin)
            print("✅ Admin/Owner created")

        if not db.query(User).filter(User.username == "accountant").first():
            accountant = User(
                username="accountant",
                hashed_password=get_password_hash("252525"),
                full_name="المحاسب المالي (Financial Accountant)",
                role="accountant",
                is_active=True
            )
            db.add(accountant)
            print("✅ Accountant created")

        # ✅ Employees (replacing legacy Barbers)
        if not db.query(Employee).first():
            employees = [
                Employee(
                    full_name="أحمد علي",
                    display_name="أحمد علي (Master Barber)",
                    phone_primary="01000000001",
                    job_title="barber",
                    is_active=True,
                    commission_rate=Decimal("15.00")
                ),
                Employee(
                    full_name="محمد حسن",
                    display_name="محمد حسن (Beard Specialist)",
                    phone_primary="01000000002",
                    job_title="barber",
                    is_active=True,
                    commission_rate=Decimal("15.00")
                ),
                Employee(
                    full_name="محمود صابر",
                    display_name="محمود صابر (Skin Care Expert)",
                    phone_primary="01000000003",
                    job_title="barber",
                    is_active=True,
                    commission_rate=Decimal("15.00")
                ),
            ]
            db.add_all(employees)
            print("✅ Employees created")

        # ✅ Service categories
        if not db.query(ServiceCategory).first():
            categories = [
                ServiceCategory(name="Hair", name_ar="شعر", icon="✂️", sort_order=1),
                ServiceCategory(name="Beard", name_ar="ذقن", icon="🧔", sort_order=2),
                ServiceCategory(name="Skin", name_ar="بشرة", icon="✨", sort_order=3),
                ServiceCategory(name="Care", name_ar="عناية", icon="🧴", sort_order=4),
            ]
            db.add_all(categories)
            print("✅ Service categories created")

        # ✅ Services
        if not db.query(Service).first():
            hair_category = db.query(ServiceCategory).filter(ServiceCategory.name_ar == "شعر").first()
            beard_category = db.query(ServiceCategory).filter(ServiceCategory.name_ar == "ذقن").first()
            skin_category = db.query(ServiceCategory).filter(ServiceCategory.name_ar == "بشرة").first()
            services = [
                Service(name="حلاقة شعر", name_ar="حلاقة شعر", category="شعر", category_id=hair_category.id if hair_category else None, price=Decimal("100.00"), duration_minutes=30),
                Service(name="حلاقة ذقن", name_ar="حلاقة ذقن", category="ذقن", category_id=beard_category.id if beard_category else None, price=Decimal("50.00"), duration_minutes=20),
                Service(name="شعر وذقن", name_ar="شعر وذقن", category="شعر", category_id=hair_category.id if hair_category else None, price=Decimal("130.00"), duration_minutes=45),
                Service(name="تنظيف بشرة", name_ar="تنظيف بشرة", category="بشرة", category_id=skin_category.id if skin_category else None, price=Decimal("150.00"), duration_minutes=40),
                Service(name="صبغة شعر", name_ar="صبغة شعر", category="شعر", category_id=hair_category.id if hair_category else None, price=Decimal("200.00"), duration_minutes=60),
            ]
            db.add_all(services)
            print("✅ Services created")

        # ✅ Products
        if not db.query(Product).first():
            products = [
                Product(name="جل شعر", category="تصفيف", unit="g", weight=Decimal("250.00"), quantity=Decimal("5000.00"), sell_price=Decimal("40.00"), cost_price=Decimal("0.10")),
                Product(name="واكس شعر", category="تصفيف", unit="g", weight=Decimal("150.00"), quantity=Decimal("3000.00"), sell_price=Decimal("60.00"), cost_price=Decimal("0.18")),
                Product(name="كريم حلاقة", category="حلاقة", unit="g", weight=Decimal("500.00"), quantity=Decimal("4000.00"), sell_price=Decimal("35.00"), cost_price=Decimal("0.07")),
            ]
            db.add_all(products)
            print("✅ Products created")

        # ✅ Expenses
        if not db.query(Expense).first():
            expenses = [
                Expense(amount=500, category="إيجار", description="إيجار المحل لشهر مايو"),
                Expense(amount=200, category="كهرباء", description="فاتورة الكهرباء"),
                Expense(amount=100, category="أدوات", description="شراء مقصات جديدة"),
            ]
            db.add_all(expenses)
            print("✅ Expenses created")

        # ✅ Business settings
        if not db.query(BusinessSettings).first():
            settings = BusinessSettings(
                salon_name="Salon Pro",
                currency="EGP",
                shop_phone="01094693361",
                allow_cash=True,
                allow_vodafone_cash=True,
                allow_instapay=True,
                allow_bank_card=True,
                cashier_discount_limit_type="percentage",
                cashier_discount_limit_value=10,
                manager_discount_limit_type="percentage",
                manager_discount_limit_value=100,
            )
            db.add(settings)
            print("✅ Settings created")

        db.commit()

    except Exception as e:
        db.rollback()
        print("❌ Seeder error:", e)

    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
