/** Customer helpers (moved from Customers page, no logic changes). */
import { Award, BadgeDollarSign, CheckCircle2, Clock, Crown, Loader2, Star, XCircle } from "lucide-react";
export function customerId(customer) {
    return customer?.customer_id || customer?.id || customer?.invoiceId;
  }

export function getInitials(name) {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

export function customerName(customer) {
    return (
      `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
      customer?.name ||
      "عميل"
    );
  }

export function secondPhone(customer) {
    return customer?.second_phone || null;
  }

export const TIER_CONFIG = {
  gold: {
    label: "ذهبي",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-400",
    icon: Crown,
  },
  silver: {
    label: "فضي",
    color: "text-slate-400",
    bg: "bg-slate-400/10",
    border: "border-slate-400",
    icon: Award,
  },
  bronze: {
    label: "برونزي",
    color: "text-orange-600",
    bg: "bg-orange-600/10",
    border: "border-orange-500",
    icon: Star,
  },
};

export function getTierInfo(tier) {
  const key = String(tier || "").toLowerCase();
  if (key.includes("gold") || key.includes("ذهبي")) return TIER_CONFIG.gold;
  if (key.includes("silver") || key.includes("فضي")) return TIER_CONFIG.silver;
  return TIER_CONFIG.bronze;
}

const normalizeStatus = (status?: string | null) =>
  String(status || "")
    .toLowerCase()
    .replace(/-/g, "_");

export function getStatusConfig(status) {
  const map: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    PENDING: {
      label: "قيد الانتظار",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      icon: Clock,
    },
    CONFIRMED: {
      label: "مؤكد",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      icon: CheckCircle2,
    },
    WAITING: {
      label: "في الانتظار",
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
      icon: Clock,
    },
    IN_PROGRESS: {
      label: "قيد التنفيذ",
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      icon: Loader2,
    },
    READY_FOR_PAYMENT: {
      label: "جاهز للدفع",
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      icon: BadgeDollarSign,
    },
    COMPLETED: {
      label: "مكتمل",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      icon: CheckCircle2,
    },
    CANCELLED: {
      label: "ملغي",
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      icon: XCircle,
    },
    AUTO_CANCELLED: {
      label: "أُلغي تلقائياً",
      color: "text-rose-700",
      bg: "bg-rose-700/10",
      icon: XCircle,
    },
    NO_SHOW: {
      label: "لم يحضر",
      color: "text-rose-700",
      bg: "bg-rose-700/10",
      icon: XCircle,
    },
  };
  const aliases: Record<string, string> = {
    ready_for_pos: "READY_FOR_PAYMENT",
    done: "COMPLETED",
    checked_out: "COMPLETED",
    paid: "COMPLETED",
    in_service: "IN_PROGRESS",
  };
  const normalized = normalizeStatus(status);
  const key = map[normalized.toUpperCase()]
    ? normalized.toUpperCase()
    : aliases[normalized] || "PENDING";
  return map[key];
}

/**
 * Invoices have no status column — real state comes from the closed/draft
 * flags on the row itself.
 */
export function getInvoiceStatusConfig(invoice) {
  const key = invoice?.is_closed ? "CLOSED" : invoice?.is_draft ? "DRAFT" : "OPEN";
  const map: Record<string, { label: string; color: string; bg: string }> = {
    CLOSED: {
      label: "مسددة",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    OPEN: {
      label: "صادرة",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    DRAFT: {
      label: "مسودة",
      color: "text-slate-400",
      bg: "bg-slate-400/10",
    },
  };
  return map[key];
}
