from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

class AttendanceCreate(BaseModel):
    userId: int
    date: datetime
    checkIn: Optional[datetime] = None
    checkOut: Optional[datetime] = None
    isAbsent: bool = False
    lateMinutes: int = 0
    penalty: Decimal = Decimal(0.0)

class AttendanceResponse(AttendanceCreate):
    id: int
    fullName: str # Joined from User

    model_config = ConfigDict(from_attributes=True)

class InvoiceEditRequestResponse(BaseModel):
    id: int
    invoiceId: int
    invoiceNo: str
    requesterName: str
    reason: str
    status: str # PENDING, APPROVED, REJECTED
    createdAt: datetime

    model_config = ConfigDict(from_attributes=True)

class ApprovalAction(BaseModel):
    status: str # APPROVED, REJECTED



