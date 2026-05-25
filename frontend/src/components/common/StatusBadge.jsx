import { useEffect } from 'react';
const toneByStatus = {
  pending: "badge badge-warning",
  confirmed: "badge badge-info",
  completed: "badge badge-success",
  cancelled: "badge badge-danger",
  canceled: "badge badge-danger",
  active: "badge badge-gold",
  inactive: "badge badge-muted",
  draft: "badge badge-muted",
  paid: "badge badge-success",
  unpaid: "badge badge-warning",
  overdue: "badge badge-danger",
};

const labelMap = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  completed: "مكتمل",
  cancelled: "ملغي",
  canceled: "ملغي",
  active: "نشط",
  inactive: "غير نشط",
  draft: "مسودة",
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  overdue: "متأخر",
};

export default function StatusBadge({ value, className = "" }) {
  const normalized = String(value || "").toLowerCase();
  const toneClass = toneByStatus[normalized] || "badge badge-muted";
  const label = labelMap[normalized] || value || "-";

  


return (

    <span className={`${toneClass} ${className}`} dir="rtl">
      {label}
    </span>
  );
}


