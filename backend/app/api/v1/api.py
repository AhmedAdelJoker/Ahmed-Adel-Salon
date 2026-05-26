from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import booking_pos_bridge
from app.api.v1.endpoints import invoice_adjustment_requests
from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.profile import router as profile_router
from app.api.v1.endpoints.employees import router as employees_router
from app.api.v1.endpoints.customers import router as customers_router
from app.api.v1.endpoints.services import router as services_router
from app.api.v1.endpoints.barbers import router as barbers_router
from app.api.v1.endpoints.appointments import router as appointments_router
from app.api.v1.endpoints.bookings import router as bookings_router
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
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints.pos_shifts import router as pos_shifts_router
from app.api.v1.endpoints.walk_in_queue import router as walk_in_queue_router
from app.api.v1.endpoints.discount_approvals import router as discount_approvals_router
from app.api.v1.endpoints.whatsapp_integration import router as whatsapp_integration_router
from app.api.v1.endpoints.expenses import router as expenses_router
from app.api.v1.endpoints.payroll import router as payroll_router
from app.api.v1.endpoints.salary_advances import router as salary_advances_router
from app.api.v1.endpoints.reviews import router as reviews_router
from app.api.v1.endpoints.barber import router as barber_router
from app.api.v1.endpoints.service_categories import router as service_categories_router
from app.api.v1.endpoints.offers import router as offers_router
from app.api.v1.endpoints.attendance import router as attendance_router
from app.api.v1.endpoints.barber_presence import router as barber_presence_router
from app.api.v1.endpoints.barber_availability import router as barber_availability_router
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.public_seo import router as public_seo_router
from app.api.v1.endpoints.reminders import router as reminders_router
from app.api.v1.endpoints.exports import router as exports_router
from app.api.v1.endpoints.imports import router as imports_router
from app.api.v1.endpoints.security_settings import router as security_settings_router
from app.api.v1.endpoints.financial_rules import router as financial_rules_router
from app.api.v1.endpoints.exports_runtime import router as exports_runtime_router
from app.api.v1.endpoints.employee_reports import router as employee_reports_router
from app.api.v1.endpoints.employee_documents import router as employee_documents_router
from app.api.v1.endpoints.cashbox import router as cashbox_router
from app.api.v1.endpoints.search import router as search_router
from app.api.v1.endpoints.dashboard_core import router as dashboard_core_router

api_router = APIRouter()

# api_router.include_router(auth_router)
api_router.include_router(auth_router)
api_router.include_router(search_router)
api_router.include_router(employees_router)
api_router.include_router(profile_router)
api_router.include_router(customers_router)
api_router.include_router(services_router)
api_router.include_router(barbers_router)
api_router.include_router(appointments_router)
api_router.include_router(bookings_router)
api_router.include_router(sessions_router)
api_router.include_router(invoices_router)
api_router.include_router(reports_router)
api_router.include_router(preferences_router)
api_router.include_router(dashboard_router)
api_router.include_router(barber_router, prefix="/barber", tags=["barber"])
api_router.include_router(activity_logs_router)
api_router.include_router(business_settings_router)
api_router.include_router(users_roles_router)
api_router.include_router(products_router)
api_router.include_router(booking_public_router)
api_router.include_router(notifications_router)
api_router.include_router(pos_shifts_router)
api_router.include_router(walk_in_queue_router)
api_router.include_router(discount_approvals_router)
api_router.include_router(whatsapp_integration_router)
api_router.include_router(expenses_router)
api_router.include_router(payroll_router)
api_router.include_router(salary_advances_router)
api_router.include_router(reviews_router)
api_router.include_router(service_categories_router)
api_router.include_router(offers_router)
api_router.include_router(attendance_router)
api_router.include_router(barber_presence_router)
api_router.include_router(barber_availability_router)
api_router.include_router(admin_router)
api_router.include_router(public_seo_router)
api_router.include_router(reminders_router)
api_router.include_router(exports_router)
api_router.include_router(imports_router)
api_router.include_router(security_settings_router)
api_router.include_router(financial_rules_router)
api_router.include_router(exports_runtime_router)
api_router.include_router(employee_reports_router)
api_router.include_router(employee_documents_router)
api_router.include_router(cashbox_router, prefix="/cashbox", tags=["cashbox"])
api_router.include_router(dashboard_core_router, prefix="/dashboard-core", tags=["dashboard-core"])

api_router.include_router(invoice_adjustment_requests.router, tags=['invoice-adjustment-requests'])

api_router.include_router(booking_pos_bridge.router, tags=['bookings-pos-bridge'])



