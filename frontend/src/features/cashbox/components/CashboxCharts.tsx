import { TrendingUp, CreditCard, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/shared/DisplayComponents";
import { cn, formatCurrency } from "@/lib/core/utils";
import { getTypeColor, getTypeLabel, PAYMENT_LABELS } from "@/features/cashbox/utils/cashboxHelpers";
import type { CashboxTrendPoint, CashboxTypeBreakdown, PaymentMethodBreakdown } from "@/types/cashbox";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Props {
  trend: CashboxTrendPoint[];
  breakdown: CashboxTypeBreakdown[];
  todayNet: number;
  byMethod?: PaymentMethodBreakdown[];
}

const PAY_COLORS: Record<string, string> = {
  cash: "#10b981",
  card: "#6366f1",
  bank_transfer: "#0ea5e9",
  wallet: "#f59e0b",
};

export function CashboxCharts({ trend, breakdown, todayNet, byMethod = [] }: Props) {
  const hasTrend = trend.some((p) => p.in !== 0 || p.out !== 0);
  const totalBreakdown = breakdown.reduce((a, b) => a + b.value, 0);
  const totalByMethod = byMethod.reduce((a, b) => a + b.value, 0);
  const hasMethod = byMethod.length > 0 && totalByMethod > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <ChartCard
        className="xl:col-span-3"
        title="تدفق آخر 7 أيام"
        subtitle="مقارنة الوارد والصادر — تواريخ محلية (كاش + غير كاش)"
        badge={
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold flex-wrap justify-end max-w-full">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> وارد
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> صادر
            </span>
            {trend.some((p) => (p.cash_in ?? 0) > 0) && (
              <span className="hidden lg:flex items-center gap-1 whitespace-nowrap text-[10px]">
                <Wallet size={10} className="text-emerald-600" /> كاش
              </span>
            )}
            <span className={cn("flex items-center gap-1 px-2 py-1 rounded-full bg-soft border border-border text-[10px] whitespace-nowrap")}>
              <TrendingUp size={12} /> صافي:&nbsp;
              <span className={cn("font-black", Number(todayNet) >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(todayNet)}</span>
            </span>
          </div>
        }
        data={hasTrend ? trend : []}
        height={280}
        emptyTitle="لا توجد حركات آخر 7 أيام"
        emptyHint="سيظهر التدفق هنا بعد تسجيل حركة خزنة"
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trend} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradInCash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOutCash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 800 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis
              tick={{ fontSize: 11, fontWeight: 800 }}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              width={44}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => {
                const labels: Record<string, string> = { in: "وارد", out: "صادر", net: "صافي", cash_in: "كاش وارد", non_cash_in: "غير نقدي وارد" };
                return [formatCurrency(value), labels[String(name)] ?? String(name)];
              }}
              labelFormatter={(l: string) => `يوم ${l}`}
              contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
            />
            <Area type="monotone" dataKey="in" name="وارد" stroke="#10b981" fill="url(#gradInCash)" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: "white" }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="out" name="صادر" stroke="#ef4444" fill="url(#gradOutCash)" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: "white" }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="net" name="صافي" stroke="#6366f1" strokeDasharray="6 3" fill="none" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 hidden sm:grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2 min-w-0">
            <div className="text-[9px] font-black text-muted uppercase truncate">إجمالي وارد 7 أيام</div>
            <div className="text-xs font-black text-emerald-700 truncate">{formatCurrency(trend.reduce((a, b) => a + b.in, 0))}</div>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-2 min-w-0">
            <div className="text-[9px] font-black text-muted uppercase truncate">إجمالي صادر</div>
            <div className="text-xs font-black text-rose-700 truncate">{formatCurrency(trend.reduce((a, b) => a + b.out, 0))}</div>
          </div>
          <div className="rounded-xl bg-slate-900 text-white p-2 min-w-0">
            <div className="text-[9px] font-black text-white/60 uppercase truncate">الصافي</div>
            <div className="text-xs font-black truncate">{formatCurrency(trend.reduce((a, b) => a + b.net, 0))}</div>
          </div>
        </div>
      </ChartCard>

      <div className="xl:col-span-2 space-y-4">
        <ChartCard
          title="توزيع الأنواع"
          subtitle="حسب نوع العملية"
          badge={
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft border-border whitespace-nowrap">
              {breakdown.length} أنواع
            </Badge>
          }
          data={breakdown}
          height={180}
          emptyTitle="لا توجد أنواع"
          emptyHint="سجل حركة خزنة ليظهر التوزيع"
        >
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={breakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                {breakdown.map((entry, idx) => (
                  <Cell key={idx} fill={getTypeColor(entry.type, idx)} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown, name: unknown) => [formatCurrency(value), getTypeLabel(String(name))]}
                contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-1 gap-1 mt-2 max-h-[90px] overflow-y-auto custom-scrollbar pr-1">
            {breakdown.slice(0, 4).map((t) => {
              const color = getTypeColor(t.type);
              const label = getTypeLabel(t.type);
              const pct = totalBreakdown ? ((t.value / totalBreakdown) * 100).toFixed(1) : "0";
              return (
                <div key={t.type} className="flex items-center gap-2 rounded-lg border border-border bg-soft/50 px-2 py-1.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[11px] font-black text-main truncate flex-1 min-w-0">{label}</span>
                  <span className="text-[10px] font-bold text-muted shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard
          title="توزيع طرق الدفع"
          subtitle="خزنة الكاش vs غير الكاش"
          badge={
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft border-border whitespace-nowrap flex items-center gap-1">
              <CreditCard size={10} /> {byMethod.length} طرق
            </Badge>
          }
          data={hasMethod ? byMethod : []}
          height={180}
          emptyTitle="لا توجد طرق دفع"
          emptyHint="فواتير الكاش والشبكة ستظهر هنا"
        >
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={hasMethod ? byMethod : [{ method: "cash", value: 1 }]} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                {(hasMethod ? byMethod : [{ method: "cash", value: 1 }]).map((entry, idx) => {
                  const col = PAY_COLORS[entry.method] ?? `hsl(${(idx * 47) % 360} 70% 50%)`;
                  return <Cell key={idx} fill={hasMethod ? col : "#e5e7eb"} stroke="white" strokeWidth={2} />;
                })}
              </Pie>
              <Tooltip
                formatter={(value: unknown, name: unknown) => {
                  const label = PAYMENT_LABELS[String(name)] ?? String(name);
                  return [formatCurrency(value), label];
                }}
                contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {(hasMethod ? byMethod : []).map((t) => {
              const label = PAYMENT_LABELS[t.method] ?? t.method;
              const col = PAY_COLORS[t.method] ?? "#6b7280";
              const pct = totalByMethod ? ((t.value / totalByMethod) * 100).toFixed(1) : "0";
              return (
                <div key={t.method} className="flex items-center gap-1.5 rounded-xl border border-border bg-soft/30 px-2 py-1.5 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col }} />
                  <span className="text-[11px] font-black text-main truncate">{label}</span>
                  <span className="text-[10px] font-bold text-muted mr-auto">{pct}%</span>
                </div>
              );
            })}
            {!hasMethod && (
              <div className="col-span-2 flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-muted">
                <Wallet size={12} /> سيظهر الكاش والشبكة بعد أول فاتورة
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
