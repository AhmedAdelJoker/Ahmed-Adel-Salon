import { Landmark, Wallet, ChevronLeft, Download, Archive, Plus, RefreshCw, Tag, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/core/utils";
import { cn } from "@/lib/core/utils";
import type { ExpenseSummary } from "@/types/expenses";

interface ExpensesHeroProps {
  summary: ExpenseSummary | null;
  pendingCount: number;
  pendingTotal: number;
  exporting?: boolean;
  onAdd: () => void;
  onExport: () => void;
  onArchive: () => void;
  onRefresh: () => void;
}

/**
 * Premium command band for the expenses page: one dark canvas carrying the
 * page identity, the three headline figures (today / month / year), the
 * pending-approvals alert, and every primary action in one place — so the
 * page reads like a trading desk, not a form.
 */
export function ExpensesHero({
  summary,
  pendingCount,
  pendingTotal,
  exporting = false,
  onAdd,
  onExport,
  onArchive,
  onRefresh,
}: ExpensesHeroProps) {
  const { t } = useTranslation("owner");
  const topCategory = summary?.top_category_ar || summary?.top_category;
  const monthGoal = Number(summary?.month_total ?? 0);
  const yearTotal = Number(summary?.year_total ?? 0);
  const todayTotal = Number(summary?.today_total ?? 0);

  const stats: Array<{ label: string; value: number; format: (v: number) => string }> = [
    { label: t("expenses.todayKpi"), value: todayTotal, format: formatCurrency },
    { label: t("expenses.monthKpi"), value: monthGoal, format: formatCurrency },
    { label: t("expenses.yearKpi"), value: yearTotal, format: formatCurrency },
  ];

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 text-white shadow-[0_60px_120px_-30px_rgba(0,0,0,0.7)]"
      aria-labelledby="expenses-hero-title"
    >
      {/* Ambient glows — champagne gold over deep slate */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 start-[-10%] h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(221,184,113,0.28),transparent_65%)] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 end-[-8%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(221,184,113,0.16),transparent_60%)] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)", backgroundSize: "22px 22px" }} />

      {/* Ghost brand mark */}
      <Landmark aria-hidden="true" size={240} strokeWidth={0.8} className="pointer-events-none absolute top-1/2 -translate-y-1/2 -end-10 text-white/[0.05]" />

      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-stretch lg:justify-between">
        {/* Identity + actions */}
        <div className="flex max-w-2xl flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">
                <Landmark size={11} /> {t("expenses.heroKicker")}
              </span>
              {topCategory && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-zinc-300">
                  <Tag size={10} className="text-amber-200" /> {t("expenses.topCategoryKpi")}: {topCategory}
                </span>
              )}
            </div>

            <h1 id="expenses-hero-title" className="mt-4 text-3xl font-black leading-[1.15] tracking-tight text-white sm:text-4xl">
              {t("expenses.title")}
            </h1>
            <p className="mt-2 max-w-md text-[12px] font-bold leading-relaxed text-zinc-400">
              {t("expenses.subtitle")}
            </p>

            {pendingCount > 0 && (
              <div role="status" className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-[11px] font-black text-amber-200">
                <Hourglass size={14} className="shrink-0" />
                <span>{t("expenses.pendingRibbon", { count: pendingCount, amount: formatCurrency(pendingTotal) })}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={onAdd}
              className="group h-12 rounded-2xl border border-amber-200/40 bg-gradient-to-br from-amber-200 to-amber-400 px-6 text-[12px] font-black text-zinc-950 shadow-[0_10px_30px_-10px_rgba(221,184,113,0.5)] transition-all hover:from-amber-100 hover:to-amber-300"
            >
              <Plus size={16} className="me-1.5 transition-transform group-hover:rotate-90" /> {t("expenses.addExpense")}
            </Button>
            <Button variant="outline" onClick={onExport} disabled={exporting} className="h-12 rounded-2xl border-white/15 bg-white/5 px-4 text-[11px] font-black text-zinc-100 backdrop-blur transition-colors hover:border-amber-300/40 hover:text-amber-200">
              <Download size={15} className="me-1.5" /> {t("expenses.exportCsv")}
            </Button>
            <Button variant="outline" onClick={onArchive} className="h-12 rounded-2xl border-white/15 bg-white/5 px-4 text-[11px] font-black text-zinc-100 backdrop-blur transition-colors hover:border-amber-300/40 hover:text-amber-200">
              <Archive size={15} className="me-1.5" /> {t("expenses.archive")}
            </Button>
            <Button variant="ghost" size="icon" onClick={onRefresh} aria-label={t("expenses.refresh")} className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 text-zinc-300 backdrop-blur hover:bg-white/10 hover:text-white">
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        {/* Headline figures */}
        <div className="flex shrink-0 items-stretch gap-0 self-stretch sm:gap-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "flex min-w-0 flex-1 flex-col justify-center gap-1.5 border-white/10 px-4 py-2 sm:min-w-[120px] sm:px-6",
                i > 0 && "border-s",
              )}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                <Wallet size={11} className="text-amber-200/70" />
                <span className="whitespace-nowrap">{stat.label}</span>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.4 }}
                className="whitespace-nowrap text-lg font-black tabular-nums tracking-tight text-amber-200 sm:text-2xl"
              >
                {stat.format(stat.value)}
              </motion.div>
              <div className="hidden h-px w-10 bg-gradient-to-r from-amber-400/70 to-transparent sm:block" />
            </div>
          ))}
          <ChevronLeft aria-hidden="true" size={16} className="hidden self-center text-zinc-700 rtl:rotate-0 ltr:rotate-180" />
        </div>
      </div>

      {/* Bottom hairline — gold accent */}
      <div aria-hidden="true" className="h-[3px] w-full bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
    </section>
  );
}
