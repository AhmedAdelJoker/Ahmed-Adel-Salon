from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)

    role = Column(String(30), nullable=False, default="cashier")
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    barber = relationship("Barber", back_populates="users")
    employee = relationship(
        "Employee",
        back_populates="linked_user",
        foreign_keys="Employee.user_id",
        uselist=False,
    )

    preference = relationship(
        "Preference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    notification_logs = relationship(
        "NotificationLog",
        back_populates="created_by_user",
        foreign_keys="NotificationLog.created_by_user_id",
    )

    @property
    def employee_id(self):
        return self.employee.id if self.employee else None
