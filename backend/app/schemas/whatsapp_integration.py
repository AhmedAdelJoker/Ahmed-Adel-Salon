from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class WhatsAppIntegrationStatusRead(BaseModel):
    configured: bool
    provider_name: str
    graph_api_version: str
    phone_number_id_present: bool
    access_token_present: bool
    verify_token_present: bool


class WhatsAppTestRequest(BaseModel):
    phone: str | None = Field(default=None, max_length=30)
    message: str | None = Field(default=None, max_length=1000)


class WhatsAppTestResponse(BaseModel):
    message: str
    normalized_phone: str
    provider_message_id: str | None = None


class WhatsAppWebhookReceiveRead(BaseModel):
    received: bool = True
    updated_logs_count: int = 0



