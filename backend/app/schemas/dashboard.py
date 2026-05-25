from datetime import datetime
from pydantic import BaseModel


class DashboardLatestInvoiceRead(BaseModel):
    id: int
    invoice_no: str
    customer_name: str
    total_amount: float
    issued_at: datetime


class DashboardLatestActivityRead(BaseModel):
    id: int
    action: str
    description: str | None = None
    created_at: datetime


class DashboardWidgetsRead(BaseModel):
    unread_notifications: int
    completed_unpaid: int
    latest_invoices: list[DashboardLatestInvoiceRead]
    latest_activities: list[DashboardLatestActivityRead]
    top_barber: dict
    top_service: dict