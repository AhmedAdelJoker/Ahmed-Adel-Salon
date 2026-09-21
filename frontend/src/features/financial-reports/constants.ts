import { FileSpreadsheet, History, Sparkles } from "lucide-react";

export const CHART_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit_card: "بطاقة ائتمان",
  card: "بطاقة",
  visa: "فيزا",
  mastercard: "ماستركارد",
  wallet: "محفظة إلكترونية",
  instapay: "انستاباي",
  bank_transfer: "تحويل بنكي",
  vodafone_cash: "فودافون كاش",
  orange_money: "أورانج موني",
};

export type PresetId = "today" | "week" | "month" | "quarter";

export const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "7 أيام" },
  { id: "month", label: "الشهر" },
  { id: "quarter", label: "90 يوم" },
];

export const REPORT_EXPORTS = [
  {
    title: "التدقيق الاستراتيجي للنمو",
    desc: "تقرير شامل يجمع الأداء المالي والخدمات الأكثر ربحية وإنتاجية الفريق بنظرة استراتيجية.",
    details: "يتضمن: ملخص KPIs، قائمة Top 5 خدمات، ترتيب أداء الموظفين.",
    icon: Sparkles,
    color: "text-purple-600 bg-purple-500/10",
    format: "PREMIUM PDF",
    endpoint: "/exports/reports/strategic-growth/pdf",
    type: "pdf" as const,
    file: "strategic_growth_report",
  },
  {
    title: "تقرير الإيرادات التفصيلي",
    desc: "كشف محاسبي بالمبيعات والتحصيلات مفصلاً حسب طريقة الدفع لمطابقة الخزينة.",
    details: "يتضمن: التاريخ، رقم الفاتورة، العميل، طريقة الدفع، القيمة الصافية.",
    icon: FileSpreadsheet,
    color: "text-indigo-600 bg-indigo-500/10",
    format: "EXCEL SHEET",
    endpoint: "/exports/reports/revenue/excel",
    type: "excel" as const,
    file: "revenue_report",
  },
  {
    title: "كشف ميزان العمليات اليومي",
    desc: "سجل زمني دقيق للحركات النقدية اليومية خلال الفترة المختارة لضمان دقة الأرشفة.",
    details: "يتضمن: تفصيل الحركات اليومية وإجمالي الوارد والصادر لكل يوم.",
    icon: History,
    color: "text-amber-600 bg-amber-500/10",
    format: "ACCOUNTING PDF",
    endpoint: "/exports/reports/daily/pdf",
    type: "pdf" as const,
    file: "daily_operations_report",
  },
] as const;

export type ReportExport = (typeof REPORT_EXPORTS)[number];
