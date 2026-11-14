from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class MonthClosure(Base):
    """قفل شهر منتهٍ في الأرشيف.

    كان `invoices.is_closed` يحمل معنيين في وقت واحد: إقفال الفاتورة
    المفردة (إلغاء/إقفال) وإقفال الشهر كاملًا. فتح الشهر كان يمسح الاثنين
    معًا، فيفقد فاتورة ملغاة وضعها، ويمنع تمييز الفاتورة المقفلة فرديًا عن
    الشهر المقفل. هذا الصف هو مصدر الحقيقة الوحيد لقفل الشهر: لا يُلمس
    `invoices.is_closed` عند القفل ولا عند الفتح.
    """

    __tablename__ = "month_closures"
    __table_args__ = (
        UniqueConstraint("year", "month", name="uq_month_closures_year_month"),
    )

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=False)
    closed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    invoice_count = Column(Integer, nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)

    closed_by_user = relationship("User", foreign_keys=[closed_by_user_id])
