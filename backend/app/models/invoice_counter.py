from datetime import date

from sqlalchemy import Column, Date, Integer

from app.db.base_class import Base


class InvoiceCounter(Base):
    __tablename__ = "invoice_counters"

    counter_date = Column(Date, primary_key=True)
    last_number = Column(Integer, nullable=False, default=0)
