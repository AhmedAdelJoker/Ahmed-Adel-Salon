from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class ReviewBase(BaseModel):
    rating: float = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    customer_name_snapshot: Optional[str] = None

class ReviewCreate(ReviewBase):
    appointment_id: Optional[int] = None
    barber_id: Optional[int] = None

class ReviewRead(ReviewBase):
    id: int
    is_public: bool
    is_verified_visit: bool
    created_at: datetime
    barber_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)



