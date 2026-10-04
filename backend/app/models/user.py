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
    profile_image_url = Column(String(255), nullable=True)

    role = Column(String(30), nullable=False, default="cashier")

    # `use_alter=True` breaks a mutual dependency that PostgreSQL refuses.
    #
    # `users.barber_id -> employees.id` and `employees.user_id -> users.id` form
    # a cycle: a user can be a barber, and an employee can have a login. SQLite
    # accepts the cycle because it defers foreign-key enforcement until the
    # statement commits, so the problem stayed invisible for the whole life of
    # the project. PostgreSQL does not: `CREATE TABLE` cannot reference a table
    # that does not exist yet, and a cycle means one of the two never can.
    #
    # Declaring this direction as an ALTER emits it after every table exists.
    # SQLAlchemy still renders it inline for SQLite, which has no
    # `ALTER TABLE ... ADD CONSTRAINT`, so the desktop build is unaffected.
    barber_id = Column(Integer, ForeignKey("employees.id", use_alter=True), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    # Bumped on password change — every JWT carries the version it was
    # issued with (``ver`` claim); older versions are rejected. This gives
    # "logout everywhere" without tracking every issued token.
    token_version = Column(Integer, nullable=False, default=0, server_default="0")

    # TOTP two-factor auth (Phase 3). ``totp_secret`` is set at setup time but
    # only enforced once ``totp_enabled`` flips on after code verification.
    # Encrypted at rest (see app/core/totp_crypto.py) — a Fernet token is ~100
    # chars, so 64 was too narrow once encryption landed.
    totp_secret = Column(String(255), nullable=True)
    totp_enabled = Column(Boolean, nullable=False, default=False, server_default="0")

    # First successful sign-in. Anchors the mandatory-2FA grace period, so an
    # account provisioned by a seed script months ago is not locked out of the
    # application on its first real use. Distinct from `created_at` on purpose;
    # see app/core/totp_enforcement.py.
    first_login_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    barber = relationship("Employee", foreign_keys=[barber_id])
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

    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @property
    def employee_id(self):
        return self.employee.id if self.employee else None

    @property
    def display_name(self):
        return self.employee.display_name if self.employee else None

    @property
    def bio_ar(self):
        return self.employee.bio_ar if self.employee else None
