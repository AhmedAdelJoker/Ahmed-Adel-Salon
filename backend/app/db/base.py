from app.db.base_class import Base  # noqa

# Core models
from app.models.user import User  # noqa
from app.models.barber import Barber  # noqa
from app.models.customer import Customer  # noqa
from app.models.customer_cancellation_log import CustomerCancellationLog  # noqa
from app.models.booking_audit_log import BookingAuditLog  # noqa
from app.models.employee import Employee  # noqa
from app.models.preference import Preference  # noqa
from app.models.notification_log import NotificationLog  # noqa
from app.models.activity_log import ActivityLog  # noqa
from app.models.audit_log_core import AuditLog  # noqa
from app.models.employee_document import EmployeeDocument  # noqa

# Core business models
from app.models.service import Service  # noqa
from app.models.service_category import ServiceCategory  # noqa
from app.models.offer import Offer  # noqa
from app.models.offer_service import OfferService  # noqa
from app.models.offer_product import OfferProduct  # noqa
from app.models.appointment import Appointment  # noqa
from app.models.appointment_service import AppointmentService  # noqa
from app.models.invoice import Invoice  # noqa
from app.models.invoice_item import InvoiceItem  # noqa
from app.models.business_settings import BusinessSettings  # noqa
from app.models.expense import Expense  # noqa
from app.models.payroll_record import PayrollRecord  # noqa
from app.models.salary_advance import SalaryAdvance  # noqa
from app.models.review import Review  # noqa

# Inventory
from app.models.product import Product  # noqa
from app.models.inventory_log import InventoryLog  # noqa
from app.models.service_product import ServiceProduct  # noqa

# Sessions
from app.models.service_session import ServiceSession  # noqa
from app.models.session_product import SessionProduct  # noqa
from app.models.pos_shift import PosShift  # noqa
from app.models.cash_transaction import CashTransaction  # noqa
from app.models.walk_in_queue import WalkInQueue  # noqa

# Availability / Presence / Notifications
from app.models.barber_working_hour import BarberWorkingHour  # noqa
from app.models.barber_time_off import BarberTimeOff  # noqa
from app.models.barber_presence_log import BarberPresenceLog  # noqa
from app.models.employee_working_hour import EmployeeWorkingHour  # noqa
from app.models.employee_time_off import EmployeeTimeOff  # noqa
from app.models.employee_presence_log import EmployeePresenceLog  # noqa
from app.models.leave_request import LeaveRequest  # noqa
from app.models.notification import Notification  # noqa

# Supporting / approval models
from app.models.discount_approval_request import DiscountApprovalRequest  # noqa
from app.models.invoice_adjustment_request import InvoiceAdjustmentRequest  # noqa
from app.models.invoice_payment import InvoicePayment  # noqa
from app.models.shop_settings import ShopSettings  # noqa
from app.models.seo_page import SeoPage  # noqa
