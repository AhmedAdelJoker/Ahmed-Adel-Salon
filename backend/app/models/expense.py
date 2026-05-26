from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func

from app.db.base_class import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(String(500), nullable=False)
    recipient_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
