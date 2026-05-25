from app.db.base_class import Base  # noqa

# Core models
from app.models.user import User  # noqa
from app.models.barber import Barber  # noqa
from app.models.customer import Customer  # noqa
from app.models.preference import Preference  # noqa
from app.models.notification_log import NotificationLog  # noqa

# Core business models
from app.models.service import Service  # noqa
from app.models.appointment import Appointment  # noqa
from app.models.appointment_service import AppointmentService  # noqa
from app.models.invoice import Invoice  # noqa
from app.models.invoice_item import InvoiceItem  # noqa
from app.models.business_settings import BusinessSettings  # noqa

# Inventory
from app.models.product import Product  # noqa
from app.models.inventory_log import InventoryLog  # noqa
from app.models.service_product import ServiceProduct  # noqa

# Sessions
from app.models.service_session import ServiceSession  # noqa
from app.models.session_product import SessionProduct  # noqa

# Availability / Presence / Notifications
from app.models.barber_working_hour import BarberWorkingHour  # noqa
from app.models.barber_time_off import BarberTimeOff  # noqa
from app.models.barber_presence_log import BarberPresenceLog  # noqa
from app.models.notification import Notification  # noqa