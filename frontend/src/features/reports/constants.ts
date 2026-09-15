import { Users, Receipt, Wallet, Clock } from "lucide-react";

export const SYSTEM_LINKS = [
  { label: "الموارد البشرية", icon: Users, desc: "بيانات الموظف والعمولة", color: "primary", href: "/owner/hr" },
  { label: "الفواتير", icon: Receipt, desc: "مصدر المبيعات والخدمات", color: "success", href: "/invoices" },
  { label: "الرواتب", icon: Wallet, desc: "المستحقات والمكافآت", color: "warning", href: "/owner/payroll" },
  { label: "الحضور", icon: Clock, desc: "الانضباط وتأثيره على الحافز", color: "info", href: "/attendance" },
];
