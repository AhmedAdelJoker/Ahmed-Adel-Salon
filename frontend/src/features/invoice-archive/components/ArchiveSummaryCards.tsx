import { motion } from "framer-motion";
import {
  DollarSign,
  Receipt,
  FolderArchive,
  Landmark,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, formatCurrency } from "@/lib/core/utils";
import type {
  ArchiveComparison,
  ArchiveMonth,
  ArchiveSummary,
} from "@/features/invoice-archive/types";

interface StatCard {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export interface ArchiveSummaryCardsProps {
  loading: boolean;
  summary: ArchiveSummary | null;
  months: ArchiveMonth[];
  maxRevenue: number;
  comparison: ArchiveComparison | null;
  expandedKey: string | null;
  onToggleExpand: (month: ArchiveMonth) => void;
}

export function ArchiveSummaryCards({
  loading,
  summary,
  months,
  maxRevenue,
  comparison,
  expandedKey,
  onToggleExpand,
}: ArchiveSummaryCardsProps) {
  const statCards: StatCard[] = [
    {
      label: "إجمالي المبيعات",
      value: summary ? formatCurrency(summary.totalRevenue) : "—",
      icon: DollarSign,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "الفواتير المؤرشفة",
      value: summary ? summary.totalInvoices : "—",
      icon: Receipt,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "الأشهر المغلقة",
      value: summary ? `${summary.closedCount} / ${months.length}` : "—",
      icon: FolderArchive,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "متوسط الشهر",
      value: summary ? formatCurrency(summary.avg) : "—",
      icon: Landmark,
      color: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-900/20",
    },
  ];

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-premium bg-card border border-border/70 animate-pulse"
            />
          ))}
        </div>
      ) : (
        summary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {statCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:shadow-premium"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted">
                      {label}
                    </p>
                    <p className="mt-1.5 truncate text-xl font-black tabular-nums text-main">
                      {value}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      bg,
                    )}
                  >
                    <Icon size={20} className={color} />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )
      )}

      {!loading && months.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-l from-primary/5 to-transparent p-5"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BarChart3 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-main">
                  نظرة عامة على أداء الأشهر
                </h3>
                <p className="text-[10px] font-bold text-muted">
                  اضغط على أي شهر لعرض فواتيره بالأسفل
                </p>
              </div>
            </div>
            {comparison && (
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg",
                    comparison.diff >= 0
                      ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20"
                      : "bg-red-50 text-red-500 dark:bg-red-900/20",
                  )}
                >
                  {comparison.diff >= 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                </span>
                <div className="text-left">
                  <p
                    className={cn(
                      "text-xs font-black tabular-nums",
                      comparison.diff >= 0
                        ? "text-emerald-500"
                        : "text-red-500",
                    )}
                  >
                    {Number(comparison.pct) > 0 ? "+" : ""}
                    {comparison.pct}%
                  </p>
                  <p className="text-[9px] font-bold text-muted">
                    {comparison.current.label_ar} مقابل{" "}
                    {comparison.previous.label_ar}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {months.slice(0, 12).map((month) => {
              const width = Math.max(
                4,
                Math.round(((month.total_amount || 0) / maxRevenue) * 100),
              );
              const isActive = expandedKey === month.key;
              return (
                <button
                  key={`bar-${month.key}`}
                  onClick={() => onToggleExpand(month)}
                  className={cn(
                    "group block w-full text-right transition-opacity hover:opacity-100",
                    !isActive && "opacity-85",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-black">
                    <span
                      className={cn(
                        "flex items-center gap-1.5",
                        isActive ? "text-primary" : "text-main",
                      )}
                    >
                      {month.label_ar}
                      <span className="rounded-md bg-soft px-1.5 py-0.5 text-[9px] font-bold text-muted">
                        {month.invoice_count} فاتورة
                      </span>
                    </span>
                    <span className="tabular-nums text-muted group-hover:text-main">
                      {formatCurrency(month.total_amount)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-soft">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        month.is_closed
                          ? "bg-gradient-to-l from-zinc-400 to-zinc-300"
                          : "bg-gradient-to-l from-emerald-500 to-teal-400",
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {comparison && (
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="p-3 rounded-xl bg-card border border-border/50">
                <p className="text-[9px] font-bold text-muted uppercase mb-1">
                  فواتير الشهر الحالي
                </p>
                <p className="text-sm font-black tabular-nums text-main">
                  {comparison.current.invoice_count}
                </p>
                <p
                  className={cn(
                    "text-[9px] font-bold",
                    comparison.invDiff >= 0
                      ? "text-emerald-500"
                      : "text-red-500",
                  )}
                >
                  {comparison.invDiff > 0 ? "+" : ""}
                  {comparison.invDiff} عن الشهر السابق
                </p>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border/50">
                <p className="text-[9px] font-bold text-muted uppercase mb-1">
                  متوسط الفاتورة
                </p>
                <p className="text-sm font-black tabular-nums text-main">
                  {formatCurrency(
                    (comparison.current.total_amount || 0) /
                      Math.max(1, comparison.current.invoice_count),
                  )}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border/50">
                <p className="text-[9px] font-bold text-muted uppercase mb-1">
                  نسبة التحصيل
                </p>
                <p className="text-sm font-black tabular-nums text-main">
                  {summary?.totalInvoices
                    ? `${Math.round((summary.totalPaid / summary.totalInvoices) * 100)}%`
                    : "—"}
                </p>
                <p className="text-[9px] font-bold text-muted">
                  {summary?.totalPaid} مدفوعة
                </p>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border/50">
                <p className="text-[9px] font-bold text-muted uppercase mb-1">
                  أعلى شهر محقق
                </p>
                <p className="text-sm font-black tabular-nums text-main">
                  {summary?.best?.label_ar}
                </p>
                <p className="text-[9px] font-bold text-primary">
                  {summary?.best
                    ? formatCurrency(summary.best.total_amount)
                    : "—"}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </>
  );
}
