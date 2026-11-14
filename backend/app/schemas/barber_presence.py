from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BarberPresenceRead(BaseModel):
    id: int
    barber_id: int
    barber_name: str | None = None
    employee_id: int | None = None
    employee_name: str | None = None
    status: str
    is_late: bool = False
    late_reason: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)