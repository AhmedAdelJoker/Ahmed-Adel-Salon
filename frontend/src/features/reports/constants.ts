import { Users, Receipt, Wallet, Clock } from "lucide-react";

export const LINK_COLORS: Record<string, string> = {
  primary: "bg-primary text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  info: "bg-info text-white",
};

export const SYSTEM_LINKS = [
  { labelKey: "empReports.quickHR", descKey: "empReports.quickHRDesc", icon: Users, color: "primary", href: "/manager/hr" },
  { labelKey: "empReports.quickInvoices", descKey: "empReports.quickInvoicesDesc", icon: Receipt, color: "success", href: "/invoices" },
  { labelKey: "empReports.quickPayroll", descKey: "empReports.quickPayrollDesc", icon: Wallet, color: "warning", href: "/owner/payroll" },
  { labelKey: "empReports.quickAttendance", descKey: "empReports.quickAttendanceDesc", icon: Clock, color: "info", href: "/attendance" },
];
