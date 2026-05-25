from pydantic import BaseModel


class TopBarberRead(BaseModel):
    barber_id: int | None = None
    barber_name: str
    sessions_count: int = 0
    total_revenue: float = 0


class TopServiceRead(BaseModel):
    service_id: int | None = None
    service_name: str
    sessions_count: int = 0
    total_revenue: float = 0


class PaymentMethodBreakdownRead(BaseModel):
    payment_method: str
    total_amount: float = 0


class ReportOverviewRead(BaseModel):
    total_revenue: float = 0
    total_invoices: int = 0
    average_invoice: float = 0
    done_sessions: int = 0

    top_barbers: list[TopBarberRead] = []
    top_services: list[TopServiceRead] = []
    payment_methods: list[PaymentMethodBreakdownRead] = []