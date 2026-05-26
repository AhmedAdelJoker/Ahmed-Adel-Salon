from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from decimal import Decimal

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: Decimal
    stock: int = 0
    minStock: int = 5
    category: str

class ProductCreate(ProductBase):
    pass

class ProductUpdate(ProductBase):
    name: Optional[str] = None
    price: Optional[Decimal] = None
    stock: Optional[int] = None
    minStock: Optional[int] = None
    category: Optional[str] = None

class ProductResponse(ProductBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class StockAdjustment(BaseModel):
    quantity: int # Positive for adding, negative for removing
    reason: str



