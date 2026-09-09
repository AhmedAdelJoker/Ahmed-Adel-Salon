from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Boolean, Numeric, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from app.models.employee_service_link import employee_services

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    
    # Personal Info
    full_name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True) # for POS/Booking/Short names
    phone_primary = Column(String(30), nullable=False)
    phone_secondary = Column(String(30), nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    national_id = Column(String(20), nullable=True)
    birth_date = Column(DateTime, nullable=True)
    governorate = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    detailed_address = Column(Text, nullable=True)
    personal_notes = Column(Text, nullable=True)
    bio_ar = Column(Text, nullable=True)
    bio_en = Column(Text, nullable=True)

    # Work Info
    job_title = Column(String(50), nullable=False, default="barber") # owner, manager, barber, barber_assistant, cashier, etc.
    department = Column(String(100), nullable=True)
    employment_type = Column(String(30), nullable=False, default="full_time") # full_time, part_time, temporary
    hire_date = Column(DateTime, nullable=True, server_default=func.now())
    status = Column(String(30), nullable=False, default="active") # active, suspended, resigned
    work_days_json = Column(JSON, nullable=True)
    work_hours_json = Column(JSON, nullable=True)
    
    # Compatibility with old Barber model
    show_in_pos = Column(Boolean, nullable=False, default=True)
    show_in_booking = Column(Boolean, nullable=False, default=True)
    allow_online_booking = Column(Boolean, nullable=False, default=True) # alias for show_in_booking
    allow_walk_in_assignment = Column(Boolean, nullable=False, default=True) # alias for show_in_pos
    
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    # Financial Info
    base_salary = Column(Numeric(10, 2), nullable=False, default=0)
    commission_rate = Column(Numeric(5, 2), nullable=False, default=0) # percentage
    fixed_bonus = Column(Numeric(10, 2), nullable=False, default=0)
    bonus_min_attendance_percent = Column(Numeric(5, 2), nullable=False, default=0) # e.g., 95%
    enable_attendance_auto_deduction = Column(Boolean, nullable=False, default=True)
    discipline_bonus = Column(Numeric(10, 2), nullable=False, default=0) # bonus if no delays/absences
    default_deductions = Column(Numeric(10, 2), nullable=False, default=0)
    payment_method = Column(String(30), nullable=True) # cash, wallet, bank
    wallet_number = Column(String(30), nullable=True)
    bank_account = Column(String(100), nullable=True)

    # Assistant Info
    assistant_of_barber_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    assistant_tasks_json = Column(JSON, nullable=True)
    receives_commission = Column(Boolean, nullable=False, default=False)
    assistant_commission_rate = Column(Numeric(5, 2), nullable=False, default=0)

    # System Info
    has_login_account = Column(Boolean, nullable=False, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    linked_user = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="employee",
        uselist=False,
        post_update=True,
    )
    
    working_hours = relationship("EmployeeWorkingHour", back_populates="employee", cascade="all, delete-orphan")
    services = relationship("Service", secondary=employee_services, back_populates="employees")
    time_offs = relationship("EmployeeTimeOff", back_populates="employee", cascade="all, delete-orphan")
    presence_logs = relationship("EmployeePresenceLog", back_populates="employee", cascade="all, delete-orphan")
    attendance_archives = relationship("AttendanceArchive", back_populates="employee", cascade="all, delete-orphan")
    attendance_penalties = relationship("AttendancePenalty", back_populates="employee", cascade="all, delete-orphan")
    payroll_records = relationship("PayrollRecord", back_populates="employee")
    reviews = relationship("Review", back_populates="employee")

    # Self-relationship for assistant
    assistant_of = relationship("Employee", remote_side=[id], backref="assistants")

    appointments = relationship("Appointment", back_populates="barber")
    invoices = relationship("Invoice", back_populates="barber")
    sessions = relationship("ServiceSession", back_populates="barber")



