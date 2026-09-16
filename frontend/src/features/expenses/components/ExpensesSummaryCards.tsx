import { Clock, Calendar, TrendingUp, Tag, FileSpreadsheet, ArrowUpRight } from "lucide-react";
import { PremiumCard } from "@/components/shared/PremiumUI";
import {
  StatCard as StatCardDisplay,
  CurrencyStatCard,
  ChartCard,
} from "@/components/shared/DisplayComponents";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/core/utils";
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
import type { ExpenseSummary } from "@/types/expenses";

interface ExpensesSummaryCardsProps {
  summary: ExpenseSummary | null;
  hasActiveFilters: boolean;
  categoryData: Array<{ name: string; value: number; color: string }>;
  paymentData: Array<{ name: string; value: number }>;
  expenseRowsCount: number;
  onSystemLinkClick: (href: string) => void;
}

export function ExpensesSummaryCards({
  summary,
  hasActiveFilters,
  categoryData,
  paymentData,
  expenseRowsCount,
  onSystemLinkClick,
}: ExpensesSummaryCardsProps) {
  return (
    <>
      <PremiumCard noPadding className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/30">
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-main">ترابط المصروفات مع النظام</h3>
              <p className="text-[11px] font-bold text-muted">كل مصروف هو عقدة مالية مرتبطة بباقي الوحدات</p>
            </div>
            <Badge variant="outline" className="mr-auto hidden sm:flex rounded-full bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-black">تكامل تلقائي</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {SYSTEM_LINKS.map((link) => (
              <button key={link.label} onClick={() => onSystemLinkClick(link.href)} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right hover:border-slate-900 hover:shadow-md transition-all">
                <div className={cn("h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0", link.color)}>
                  <link.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-main flex items-center gap-1">
                    {link.label} <ArrowUpRight size={12} className="text-muted group-hover:text-slate-900 transition-colors" />
                  </div>
                  <div className="text-[10px] font-bold text-muted leading-tight mt-0.5 line-clamp-2">{link.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      <div data-stats-grid="true">
        <CurrencyStatCard label="اليوم" value={Number(summary?.today_total ?? 0)} icon={Clock} variant="danger" />
        <CurrencyStatCard label="هذا الشهر" value={Number(summary?.month_total ?? summary?.total_amount ?? 0)} icon={Calendar} variant="primary" />
        <CurrencyStatCard label="هذا العام" value={Number(summary?.year_total ?? 0)} icon={TrendingUp} variant="success" />
        <StatCardDisplay label="أعلى فئة" value={String(summary?.top_category || "—")} icon={Tag} variant="warning" />
      </div>

      {summary && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="text-muted">العدد الكلي:</span>
          <Badge className="bg-slate-900 text-white rounded-full px-3 font-black">{summary.count || 0} سجل</Badge>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="text-muted">الإجمالي:</span>
          <span className="font-black text-main">{formatCurrency(summary.total_amount || 0)}</span>
          {hasActiveFilters && <Badge variant="outline" className="rounded-full bg-amber-50 text-amber-700 border-amber-200 mr-2">مفلتر</Badge>}
        </div>
      )}

      {expenseRowsCount > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 min-w-0">
          <ChartCard className="xl:col-span-3" title="توزيع الفئات" subtitle="نسب المصاريف حسب كل فئة"
            badge={<Badge variant="outline" className="rounded-full text-[10px] font-black whitespace-nowrap">{categoryData.length} فئات</Badge>}
            data={categoryData} height={300} emptyTitle="لا توجد فئات بعد" emptyHint="سجّل مصاريف متعددة لرؤية التوزيع">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={{ top: 0, right: 0, bottom: 12, left: 0 }}>
                <Pie data={categoryData} cx="50%" cy="44%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">
                  {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12 }} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 8, fontSize: 11, lineHeight: "18px" }} formatter={(value) => <span className="text-[11px] font-black text-main">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard className="xl:col-span-2" title="طرق الدفع" subtitle="قيمة المصاريف لكل وسيلة دفع"
            data={paymentData} height={300} emptyTitle="لا توجد بيانات دفع" emptyHint="سجّل مصاريف بوسائل دفع مختلفة">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentData} margin={{ top: 8, right: 8, left: -8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} interval={0} angle={-15} textAnchor="end" height={36} tickMargin={8} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
                <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontWeight: 700, fontSize: 11 }} />
                <Bar dataKey="value" fill="#0f172a" radius={[8, 8, 0, 0]} barSize={28} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </>
  );
}
