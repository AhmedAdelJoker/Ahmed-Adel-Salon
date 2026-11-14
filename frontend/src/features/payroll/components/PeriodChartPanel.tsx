import { YEARS, toNumber, pctLabel } from "@/features/payroll";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/core/utils";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Activity, AlertCircle, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { PayrollSummary, Period } from "@/types/payroll";

type PeriodChartPanelProps = {
  period: Period;
  setPeriod: React.Dispatch<React.SetStateAction<Period>>;
  summary: PayrollSummary | null;
  paidPct: number;
  pieData: { name: string; value: number }[];
  pieTotal: number;
  growth: number | null;
  prevLabel: string;
};

function formatSignedPct(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "+";
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

export default function PeriodChartPanel({
  period,
  setPeriod,
  summary,
  paidPct,
  pieData,
  pieTotal,
  growth,
  prevLabel,
}: PeriodChartPanelProps) {
  const { t } = useTranslation("owner");
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
      <PremiumCard className="xl:col-span-3 p-5 flex flex-col min-w-0" animate={false}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted">{t("payroll.fiscalPeriod")}</div>
          <span className="text-[10px] font-black rounded-full bg-soft border border-border px-2 py-0.5">{t("payroll.compareBadge", { label: prevLabel })}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={String(period.month)} onValueChange={(v) => setPeriod({ ...period, month: Number(v) })}>
            <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => <SelectItem key={n} value={String(n)}>{t(`payroll.months.m${n}`)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(period.year)} onValueChange={(v) => setPeriod({ ...period, year: Number(v) })}>
            <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="mt-4 p-4 rounded-2xl bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="text-[10px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2"><Activity size={12} /> {t("payroll.totalBlock")}</div>
            <div className="text-2xl font-black tabular-nums mt-1">{formatCurrency(summary?.total_net_salary)}</div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] font-bold mb-1"><span className="text-white/70">{t("payroll.paidPctLabel")}</span><span>{paidPct}%</span></div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${paidPct}%` }} /></div>
            </div>
            <div className="flex gap-2 mt-3 text-[10px] font-bold">
              <span className="px-2.5 py-1 rounded-full bg-white/10">{t("payroll.paidAmountLabel", { amount: formatCurrency(summary?.paid_total) })}</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-200">{t("payroll.remainingAmountLabel", { amount: formatCurrency(summary?.unpaid_total) })}</span>
            </div>
            {growth !== null && (
              <div className="mt-3 flex items-center gap-1 text-[11px] font-black">
                {growth >= 0 ? <TrendingUp size={14} className="text-emerald-300" /> : <TrendingDown size={14} className="text-rose-300" />}
                <span className={growth >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatSignedPct(growth)} {t("payroll.vsPeriod", { period: prevLabel })}</span>
              </div>
            )}
          </div>
        </div>
      </PremiumCard>

      <PremiumCard className="xl:col-span-5 p-5 min-w-0 flex flex-col" animate={false}>
        <h3 className="text-xs font-black uppercase tracking-widest text-muted mb-1 flex items-center gap-2"><Sparkles size={12} className="text-primary" /> {t("payroll.costAnalysisTitle")}</h3>
        <p className="text-[10px] font-bold text-muted mb-3">{t("payroll.costAnalysisSubtitle")}</p>
        <div className="h-[220px] w-full min-w-0 flex-1">
          {pieTotal > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">
                  <Cell fill="var(--chart-1)" />
                  <Cell fill="var(--chart-2)" />
                  <Cell fill="var(--chart-3)" />
                  <Cell fill="var(--chart-7)" />
                  <Cell fill="var(--chart-4)" />
                </Pie>
                <RechartsTooltip formatter={(v: number | string) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 800, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted">
              <div className="h-12 w-12 rounded-2xl bg-soft border flex items-center justify-center"><Activity size={18} /></div>
              <p className="text-xs font-black">{t("payroll.noCostData")}</p><p className="text-[11px] font-bold">{t("payroll.recalculate")}</p>
            </div>
          )}
        </div>
        {pieTotal > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40">
            <div className="text-center"><div className="text-[9px] font-black text-muted uppercase">{t("payroll.entitlements")}</div><div className="text-xs font-black text-main">{formatCurrency(toNumber(summary?.total_base_salary) + toNumber(summary?.total_commissions) + toNumber(summary?.total_bonuses))}</div></div>
            <div className="text-center border-x border-border/40"><div className="text-[9px] font-black text-muted uppercase">{t("payroll.deductionsLabel")}</div><div className="text-xs font-black text-rose-600">{formatCurrency(toNumber(summary?.total_deductions) + toNumber(summary?.total_advances))}</div></div>
            <div className="text-center"><div className="text-[9px] font-black text-muted uppercase">{t("payroll.netLabel")}</div><div className="text-xs font-black text-primary">{formatCurrency(summary?.total_net_salary)}</div></div>
          </div>
        )}
      </PremiumCard>

      <div className="xl:col-span-4 grid grid-cols-2 gap-3 min-w-0 content-start">
        <PremiumCard className="p-4 border-s-4 border-slate-900" animate={false}>
          <div className="text-[10px] font-black text-muted uppercase">{t("payroll.baseLabel")}</div>
          <div className="text-lg font-black tabular-nums">{formatCurrency(summary?.total_base_salary)}</div>
          <div className="text-[10px] font-bold text-muted">{toNumber(summary?.employees_count) || 0} {t("payroll.employeeShort")}</div>
        </PremiumCard>
        <PremiumCard className="p-4 border-s-4 border-sky-500" animate={false}>
          <div className="text-[10px] font-black text-muted uppercase">{t("payroll.pieCommissions")}</div>
          <div className="text-lg font-black tabular-nums text-sky-600">{formatCurrency(summary?.total_commissions)}</div>
          <div className="text-[10px] font-bold text-sky-600/70">{pctLabel(summary?.total_commissions, summary?.total_net_salary)}</div>
        </PremiumCard>
        <PremiumCard className="p-4 border-s-4 border-emerald-500" animate={false}>
          <div className="text-[10px] font-black text-muted uppercase">{t("payroll.pieBonuses")}</div>
          <div className="text-lg font-black text-emerald-600">{formatCurrency(summary?.total_bonuses)}</div>
          <div className="text-[10px] font-bold text-emerald-600/70">{pctLabel(summary?.total_bonuses, summary?.total_net_salary)}</div>
        </PremiumCard>
        <PremiumCard className="p-4 border-s-4 border-rose-500" animate={false}>
          <div className="text-[10px] font-black text-muted uppercase">{t("payroll.deductionsAdvancesLabel")}</div>
          <div className="text-lg font-black text-rose-600">{formatCurrency(toNumber(summary?.total_deductions) + toNumber(summary?.total_advances))}</div>
          <div className="text-[10px] font-bold text-rose-600/70">{t("payroll.deductedFromNet")}</div>
        </PremiumCard>
        <PremiumCard className="col-span-2 p-3 bg-amber-50/50 border-amber-200" animate={false}>
          <div className="flex items-center justify-between text-[11px] font-black">
            <span className="text-muted flex items-center gap-1"><AlertCircle size={12} /> {t("payroll.analysisNote")}</span>
            <span className="text-amber-700">{paidPct === 100 ? t("payroll.completed") : paidPct > 50 ? t("payroll.inProgress") : t("payroll.needsPay")}</span>
          </div>
          <p className="text-[11px] font-bold text-muted mt-1 leading-relaxed">{t("payroll.donutNote")}</p>
        </PremiumCard>
      </div>
    </div>
  );
}
