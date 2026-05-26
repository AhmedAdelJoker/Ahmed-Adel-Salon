from fastapi import APIRouter, Depends
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(tags=["Stubs"])

class StubResponse(BaseModel):
    data: List = []

@router.get("/offers/active")
def get_active_offers():
    return []

@router.get("/offers")
def list_offers():
    return []

@router.get("/service-categories")
def list_service_categories():
    return []
