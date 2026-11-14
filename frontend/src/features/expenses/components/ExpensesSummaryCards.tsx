import { TrendingUp, TrendingDown, FileSpreadsheet, ArrowUpRight, Hourglass } from "lucide-react";
import { PremiumCard } from "@/components/shared/PremiumUI";
import {
  ChartCard,
} from "@/components/shared/DisplayComponents";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { SYSTEM_LINKS } from "@/features/expenses/constants";
import type { ExpenseSummary, ExpenseTrendPoint } from "@/types/expenses";

interface ExpensesSummaryCardsProps {
  summary: ExpenseSummary | null;
  hasActiveFilters: boolean;
  categoryData: Array<{ name: string; value: number; color: string }>;
  paymentData: Array<{ name: string; value: number }>;
  trend: ExpenseTrendPoint[];
  onSystemLinkClick: (href: string) => void;
  onReviewPending: () => void;
}

export function ExpensesSummaryCards({
  summary,
  hasActiveFilters,
  categoryData,
  paymentData,
  trend,
  onSystemLinkClick,
  onReviewPending,
}: ExpensesSummaryCardsProps) {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(y, (m ?? 1) - 1, 1));
  };
  const trendData = (trend || []).map((p) => ({ ...p, label: monthLabel(p.month) }));
  const trendTotal = trendData.reduce((s, p) => s + p.total, 0);
  const pendingCount = Number(summary?.pending_count ?? 0);
  const pendingTotal = Number(summary?.pending_total ?? 0);

  return (
    <>
      <PremiumCard noPadding className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/30">
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-amber-300">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-main">{t("expenses.linkageTitle")}</h3>
              <p className="text-[11px] font-bold text-muted">{t("expenses.linkageSubtitle")}</p>
            </div>
            <Badge variant="outline" className="me-auto hidden sm:flex rounded-full bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-black">{t("expenses.autoIntegration")}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {SYSTEM_LINKS.map((link) => (
              <button
                key={link.key}
                onClick={() => onSystemLinkClick(link.href)}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right transition-all hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-premium"
              >
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white", link.color)}>
                  <link.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-xs font-black text-main">
                    {t(`expenses.systemLinks.${link.key}Label`)} <ArrowUpRight size={12} className="text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] font-bold leading-tight text-muted">{t(`expenses.systemLinks.${link.key}Desc`)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={onReviewPending}
          role="status"
          className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-amber-300/60 bg-gradient-to-l from-amber-50 to-amber-100/60 px-4 py-3 text-start text-[11px] font-black text-amber-900 transition-all hover:border-amber-400 hover:shadow-md"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white"><Hourglass size={16} /></span>
          <span className="min-w-0">
            <span className="block">{t("expenses.pendingRibbon", { count: pendingCount, amount: formatCurrency(pendingTotal) })}</span>
            <span className="mt-0.5 block text-[10px] font-bold text-amber-800/80">{t("expenses.pendingRibbonHint")}</span>
          </span>
          <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-xl border border-amber-400/60 bg-white/60 px-3 py-1.5 text-[10px] font-black text-amber-900">{t("expenses.reviewPending")} <ArrowUpRight size={12} /></span>
        </button>
      )}

      {/* Charts: category split · payment mix · 12-month trajectory */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title={t("expenses.categoryDistribution")} subtitle={t("expenses.categoryDistributionSub")}
          badge={<Badge variant="outline" className="rounded-full text-[10px] font-black whitespace-nowrap">{t("expenses.categoriesCount", { count: categoryData.length })}</Badge>}
          data={categoryData} height={280} emptyTitle={t("expenses.noCategoryData")} emptyHint={t("expenses.noCategoryDataHint")}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart margin={{ top: 0, right: 0, bottom: 12, left: 0 }}>
              <Pie data={categoryData} cx="50%" cy="44%" innerRadius={50} outerRadius={76} paddingAngle={3} dataKey="value" stroke="none">
                {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--surface-raised)" strokeWidth={2} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12 }} />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 8, fontSize: 11, lineHeight: "18px" }} formatter={(value) => <span className="text-[11px] font-black text-main">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("expenses.paymentMethodsChart")} subtitle={t("expenses.paymentMethodsChartSub")}
          data={paymentData} height={280} emptyTitle={t("expenses.noPaymentData")} emptyHint={t("expenses.noPaymentDataHint")}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={paymentData} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} interval={0} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
              <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontWeight: 700, fontSize: 11 }} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[8, 8, 0, 0]} barSize={30} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard className="xl:col-span-1" title={t("expenses.trendTitle")} subtitle={t("expenses.trendSub")}
          badge={trendTotal > 0 ? <Badge variant="outline" className="rounded-full text-[10px] font-black whitespace-nowrap"><TrendingUp size={11} className="me-1" />{formatCurrency(trendTotal)}</Badge> : undefined}
          data={trendData} height={280} emptyTitle={t("expenses.noTrendData")} emptyHint={t("expenses.noTrendDataHint")}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData} margin={{ top: 8, right: 0, left: -4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700 }} interval={0} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontWeight: 800, fontSize: 11 }}
                formatter={(value, _name, entry) => {
                  const point = entry?.payload as ExpenseTrendPoint | undefined;
                  return [formatCurrency(value), point ? `${point.count} ${t("expenses.recordsSuffix")}` : t("expenses.totalAmountLabel")];
                }}
              />
              <Bar dataKey="total" radius={[7, 7, 0, 0]} barSize={22} maxBarSize={34}>
                {trendData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === trendData.length - 1 ? "var(--accent)" : "var(--chart-2)"} opacity={index === trendData.length - 1 ? 1 : 0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {summary && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="text-muted">{t("expenses.totalCountLabel")}</span>
          <Badge className="bg-zinc-950 text-amber-200 rounded-full px-3 font-black">{summary.count || 0} {t("expenses.recordsSuffix")}</Badge>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="text-muted">{t("expenses.totalAmountLabel")}</span>
          <span className="font-black text-main">{formatCurrency(summary.total_amount || 0)}</span>
          {hasActiveFilters && <Badge variant="outline" className="rounded-full bg-amber-50 text-amber-700 border-amber-200">{t("expenses.filteredBadge")}</Badge>}
          {trendTotal > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="text-muted">{t("expenses.trendTotalLabel")}</span>
              <span className="font-black text-main inline-flex items-center gap-1"><TrendingDown size={12} className="text-rose-500" />{formatCurrency(trendTotal)}</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
