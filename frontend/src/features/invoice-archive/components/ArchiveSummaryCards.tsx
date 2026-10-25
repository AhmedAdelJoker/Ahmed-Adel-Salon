import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  FileText,
  Landmark,
  Lock,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, formatCurrency } from "@/lib/core/utils";
import type {
  ArchiveComparison,
  ArchiveMonth,
  ArchiveSummary,
} from "@/features/invoice-archive/types";

export interface ArchiveSummaryCardsProps {
  loading: boolean;
  summary: ArchiveSummary | null;
  months: ArchiveMonth[];
  comparison: ArchiveComparison | null;
}

function changeText(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function ArchiveSummaryCards({
  loading,
  summary,
  months,
  comparison,
}: ArchiveSummaryCardsProps) {
  const chartMonths = months.slice(0, 6).reverse();
  const maxRevenue = Math.max(
    ...chartMonths.map((month) => month.total_amount || 0),
    1,
  );

  if (loading) {
    return (
      <div className="h-[218px] animate-pulse rounded-[28px] bg-gradient-to-br from-primary-strong/80 via-primary/70 to-primary-strong/80 shadow-premium" />
    );
  }

  if (!summary) {
    return (
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary-strong via-primary to-primary-strong px-5 py-6 text-white shadow-premium">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <Archive size={20} />
          </div>
          <div>
            <p className="text-sm font-black">أرشيف الفواتير</p>
            <p className="text-[11px] font-bold text-white/60">
              لا توجد أشهر مؤرشفة حتى الآن
            </p>
          </div>
        </div>
      </section>
    );
  }

  const comparisonPct = comparison ? comparison.pct : null;
  const comparisonPositive = (comparison?.diff || 0) >= 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary-strong via-primary to-primary-strong px-4 py-4 text-white shadow-premium sm:px-7 sm:py-5"
    >
      <div className="pointer-events-none absolute -end-20 -top-24 h-64 w-64 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -start-14 -bottom-24 h-56 w-56 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/10 to-transparent" />

      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end lg:gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
            <Archive size={13} />
            <span>الأرشيف المالي</span>
          </div>

          <p className="mt-2 text-[11px] font-bold text-white/65">
            إجمالي مبيعات الأرشيف
          </p>
          <p className="mt-1 truncate text-3xl font-black tabular-nums tracking-tight sm:text-4xl">
            {formatCurrency(summary.totalRevenue)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-white/60">
            <span>{summary.totalInvoices} فاتورة نهائية</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>{months.length} أشهر</span>
            {summary.totalDrafts > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-300/15 px-2 py-1 text-amber-200">
                <FileText size={10} />
                {summary.totalDrafts} مسودة غير مؤرشفة
              </span>
            )}
          </div>

          {comparison ? (
            <div
              className={cn(
                "mt-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[10px] font-black",
                comparisonPositive
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                  : "border-red-300/20 bg-red-300/10 text-red-200",
              )}
            >
              {comparisonPositive ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              <span dir="ltr">{changeText(comparisonPct)}</span>
              <span className="font-bold text-white/60">
                {comparison.current.label_ar} مقابل{" "}
                {comparison.previous.label_ar}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-[10px] font-bold text-white/45">
              لا توجد مقارنة كافية بعد — يحتاج الأرشيف إلى شهرين على الأقل.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          <HeroStat
            icon={Receipt}
            label="فاتورة نهائية"
            value={summary.totalInvoices}
          />
          <HeroStat
            icon={Lock}
            label="أشهر مقفلة"
            value={`${summary.lockedMonths} من ${months.length}`}
          />
          <div className="hidden sm:block">
            <HeroStat
              icon={ShieldCheck}
              label="فواتير ملغاة"
              value={`${summary.totalVoidedInvoices} · ${summary.voidRate}%`}
            />
          </div>
          <HeroStat
            icon={Landmark}
            label={
              <>
                <span className="sm:hidden">المتوسط</span>
                <span className="hidden sm:inline">متوسط الشهر</span>
              </>
            }
            value={formatCurrency(summary.avg)}
          />
        </div>
      </div>

      {chartMonths.length > 0 && (
        <div className="relative mt-4 hidden border-t border-white/10 pt-3 sm:block">
          <div className="flex items-end gap-2 sm:gap-3">
            <div className="flex h-12 flex-1 items-end gap-1.5 sm:gap-2.5">
              {chartMonths.map((month) => {
                const height = Math.max(
                  8,
                  Math.round(
                    ((month.total_amount || 0) / maxRevenue) * 100,
                  ),
                );
                return (
                  <div
                    key={month.key}
                    className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${month.label_ar}: ${formatCurrency(month.total_amount)}`}
                  >
                    <div className="flex h-8 w-full items-end justify-center">
                      <div
                        className={cn(
                          "w-full max-w-9 rounded-t-md transition-all duration-500",
                          month.status === "locked"
                            ? "bg-amber-300/75"
                            : month.status === "partial"
                              ? "bg-sky-300/75"
                              : "bg-emerald-300/70",
                        )}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[8px] font-bold text-white/50 group-hover:text-white/80">
                      {month.label_ar.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="hidden shrink-0 text-left text-[9px] font-bold text-white/40 sm:block">
              آخر {chartMonths.length} أشهر
              <br />
              بالجنيه المصري
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: ReactNode;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-2.5 py-2 backdrop-blur-sm sm:px-3 sm:py-2.5">
      <div className="flex items-center gap-1.5 text-[9px] font-bold text-white/60">
        <Icon size={12} />
        {label}
      </div>
      <p className="mt-1 truncate text-[11px] font-black tabular-nums text-white sm:text-base">
        {value}
      </p>
    </div>
  );
}

export interface ArchiveInsightsProps {
  summary: ArchiveSummary | null;
  comparison: ArchiveComparison | null;
}

export function ArchiveInsights({
  summary,
  comparison,
}: ArchiveInsightsProps) {
  if (!summary) return null;

  return (
    <aside className="rounded-3xl border border-border/70 bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <ShieldCheck size={15} />
        </div>
        <div>
          <h2 className="text-xs font-black text-main">قراءة سريعة</h2>
          <p className="text-[9px] font-bold text-muted">
            أرقام الشهور النهائية
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <InsightRow
          label="أعلى شهر"
          value={summary.best?.label_ar || "—"}
          detail={
            summary.best ? formatCurrency(summary.best.total_amount) : "—"
          }
        />
        <InsightRow
          label="متوسط الفاتورة"
          value={formatCurrency(summary.avgInvoice)}
          detail={`${summary.totalInvoices} فاتورة نهائية`}
        />
        <InsightRow
          label="آخر مقارنة"
          value={
            comparison
              ? `${changeText(comparison.pct)} ${comparison.current.label_ar}`
              : "—"
          }
          detail={
            comparison
              ? `مقابل ${comparison.previous.label_ar}`
              : "يحتاج شهرين على الأقل"
          }
          tone={
            comparison
              ? comparison.diff >= 0
                ? "up"
                : "down"
              : "neutral"
          }
        />
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-soft/50 p-3">
        <div className="flex items-center justify-between text-[10px] font-black">
          <span className="text-main">الفواتير الملغاة</span>
          <span dir="ltr" className="tabular-nums text-primary">
            {summary.voidRate}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full rounded-full bg-gradient-to-l from-primary to-primary/60"
            style={{ width: `${summary.voidRate}%` }}
          />
        </div>
        <p className="mt-1.5 text-[9px] font-bold text-muted">
          {summary.totalVoidedInvoices} من {summary.totalInvoices} فاتورة
          ملغاة
        </p>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[9px] font-bold leading-relaxed text-muted">
        <FileText size={11} className="mt-0.5 shrink-0" />
        كل الأرقام تستثني المسودات، وقفل الشهر يمنع تعديل فواتيره فقط، والفاتورة
        الملغاة منفردة تبقى ملغاة بعد إعادة فتحه.
      </p>
    </aside>
  );
}

function InsightRow({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-soft/30 px-3 py-2.5">
      <p className="text-[9px] font-bold text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-xs font-black",
          tone === "up"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "down"
              ? "text-red-500"
              : "text-main",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[9px] font-bold text-muted">
        {detail}
      </p>
    </div>
  );
}
