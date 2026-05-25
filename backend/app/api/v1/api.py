from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.profile import router as profile_router
from app.api.v1.endpoints.customers import router as customers_router
from app.api.v1.endpoints.services import router as services_router
from app.api.v1.endpoints.barbers import router as barbers_router
from app.api.v1.endpoints.appointments import router as appointments_router
from app.api.v1.endpoints.sessions import router as sessions_router
from app.api.v1.endpoints.invoices import router as invoices_router
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.preferences import router as preferences_router
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.activity_logs import router as activity_logs_router
from app.api.v1.endpoints.business_settings import router as business_settings_router
from app.api.v1.endpoints.users_roles import router as users_roles_router
from app.api.v1.endpoints.products import router as products_router
from app.api.v1.endpoints.booking_public import router as booking_public_router
from app.api.v1.endpoints.barber_availability import router as barber_availability_router
from app.api.v1.endpoints.barber_presence import router as barber_presence_router
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints.reminders import router as reminders_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(customers_router)
api_router.include_router(services_router)
api_router.include_router(barbers_router)
api_router.include_router(appointments_router)
api_router.include_router(sessions_router)
api_router.include_router(invoices_router)
api_router.include_router(reports_router)
api_router.include_router(preferences_router)
api_router.include_router(dashboard_router)
api_router.include_router(activity_logs_router)
api_router.include_router(business_settings_router)
api_router.include_router(users_roles_router)
api_router.include_router(products_router)
api_router.include_router(booking_public_router)
api_router.include_router(barber_availability_router)
api_router.include_router(barber_presence_router)
api_router.include_router(notifications_router)
api_router.include_router(reminders_router)
