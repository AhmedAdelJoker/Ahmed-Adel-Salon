from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BarberPresenceRead(BaseModel):
    barber_id: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)