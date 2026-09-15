from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class EmployeePerformanceItem(BaseModel):
    employee_id: int
    employee_name: str
    job_title: Optional[str] = None
    sales: float = Field(ge=0, description="إجمالي المبيعات")
    commission: float = Field(ge=0, description="إجمالي العمولة")
    service_count: int = Field(ge=0, description="عدد الخدمات")
    invoice_count: int = Field(ge=0, description="عدد الفواتير")
    avg_ticket: float = Field(ge=0, description="متوسط الفاتورة")
    top_service_name: Optional[str] = None
    commission_rate: Optional[float] = None


class EmployeePerformanceResponse(BaseModel):
    items: list[EmployeePerformanceItem]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)
    summary: "EmployeePerformanceSummary"


class EmployeePerformanceSummary(BaseModel):
    total_sales: float = Field(ge=0)
    total_commission: float = Field(ge=0)
    total_services: int = Field(ge=0)
    total_invoices: int = Field(ge=0)
    employee_count: int = Field(ge=0)
    avg_sales_per_employee: float = Field(ge=0)


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