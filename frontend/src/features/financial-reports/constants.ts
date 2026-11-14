import { FileSpreadsheet, History, Sparkles } from "lucide-react";
import { CHART_COLORS } from "@/lib/core/chart";

// Re-exported so existing feature consumers keep their import path. The
// canonical definition lives in @/lib/core/chart so that non-financial charts
// (cashbox, expenses, POS) share one theme-aware palette.
export { CHART_COLORS };

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "finFeat.pay.cash",
  credit_card: "finFeat.pay.credit_card",
  card: "finFeat.pay.card",
  visa: "finFeat.pay.visa",
  mastercard: "finFeat.pay.mastercard",
  wallet: "finFeat.pay.wallet",
  instapay: "finFeat.pay.instapay",
  bank_transfer: "finFeat.pay.bank_transfer",
  vodafone_cash: "finFeat.pay.vodafone_cash",
  orange_money: "finFeat.pay.orange_money",
};

export type PresetId = "today" | "week" | "month" | "quarter";

export const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: "today", label: "finRep.preset.today" },
  { id: "week", label: "finRep.preset.week" },
  { id: "month", label: "finRep.preset.month" },
  { id: "quarter", label: "finRep.preset.quarter" },
];

export const REPORT_EXPORTS = [
  {
    title: "finRep.reportCards.growth.title",
    desc: "finRep.reportCards.growth.desc",
    details: "finRep.reportCards.growth.details",
    icon: Sparkles,
    color: "text-purple-600 bg-purple-500/10",
    format: "PREMIUM PDF",
    endpoint: "/exports/reports/strategic-growth/pdf",
    type: "pdf" as const,
    file: "strategic_growth_report",
  },
  {
    title: "finRep.reportCards.revenue.title",
    desc: "finRep.reportCards.revenue.desc",
    details: "finRep.reportCards.revenue.details",
    icon: FileSpreadsheet,
    color: "text-indigo-600 bg-indigo-500/10",
    format: "EXCEL SHEET",
    endpoint: "/exports/reports/revenue/excel",
    type: "excel" as const,
    file: "revenue_report",
  },
  {
    title: "finRep.reportCards.ledger.title",
    desc: "finRep.reportCards.ledger.desc",
    details: "finRep.reportCards.ledger.details",
    icon: History,
    color: "text-amber-600 bg-amber-500/10",
    format: "ACCOUNTING PDF",
    endpoint: "/exports/reports/daily/pdf",
    type: "pdf" as const,
    file: "daily_operations_report",
  },
] as const;

export type ReportExport = (typeof REPORT_EXPORTS)[number];
