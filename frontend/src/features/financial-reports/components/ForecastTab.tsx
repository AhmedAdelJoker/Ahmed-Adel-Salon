import { BarChart3, CalendarRange, Zap, Sparkles } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/core/utils";
import { ChartCard } from "@/components/shared/DisplayComponents";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { FinanceTooltip } from "@/features/financial-reports/components/FinancialChartBits";
import { compactTick } from "@/features/financial-reports/utils";
import AIInsights from "@/components/AIInsights";
import type { MonthlyBucket } from "@/lib/money/financialAnalytics";

export interface ForecastTabProps {
  monthly: MonthlyBucket[];
  monthlyLoading: boolean;
  monthlyLoaded: boolean;
  forecast: {
    avgRev: number;
    avgExp: number;
    projRev: number;
    projExp: number;
    projNet: number;
    basisDays: number;
    cumulative: Array<{ name: string; net: number }>;
  } | null;
  aiInsights: Parameters<typeof AIInsights>[0]["data"];
  fetchSixMonths: () => void;
}

export function ForecastTab({
  monthly,
  monthlyLoading,
  monthlyLoaded,
  forecast,
  aiInsights,
  fetchSixMonths,
}: ForecastTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {!monthlyLoaded ? (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarRange size={26} className="text-muted" />
              <p className="text-sm font-black text-main">المقارنة الشهرية جاهزة عند الطلب</p>
              <p className="text-xs font-bold text-muted">اضغط تحميل لجلب 6 شهور وتجميعها شهرياً.</p>
              <Button
                onClick={fetchSixMonths}
                loading={monthlyLoading}
                variant="outline"
                size="sm"
                className="mt-2 shrink-0 gap-2 text-[11px] font-black"
              >
                <BarChart3 size={14} /> تحميل المقارنة
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ChartCard
            title={
              <span className="flex items-center gap-2">
                <CalendarRange size={16} className="text-indigo-600" /> مقارنة آخر 6 شهور
              </span>
            }
            subtitle="الإيرادات مقابل المصروفات شهرياً من البيانات الحقيقية"
            data={monthly}
            height={260}
            className="overflow-hidden"
          >
            <div className="h-[260px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={compactTick}
                    tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                  />
                  <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 800 }} />
                  <Bar dataKey="rev" name="الإيرادات" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="exp" name="المصروفات" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="الصافي"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#6366F1" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        {!forecast ? (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Zap size={26} className="text-muted" />
              <p className="text-sm font-black text-main">لا توجد بيانات كافية للإسقاط</p>
              <p className="text-xs font-bold text-muted">اختر نطاقاً زمنياً فيه حركات مالية.</p>
            </CardContent>
          </Card>
        ) : (
          <ChartCard
            title={
              <span className="flex items-center gap-2">
                <Zap size={16} className="text-violet-600" /> إسقاط التدفق النقدي — 30 يوم
              </span>
            }
            subtitle={`بناءً على متوسط آخر ${forecast.basisDays} يوم من الفترة الحالية`}
            data={forecast.cumulative}
            height={260}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">إيراد متوقع</p>
                <p className="mt-1 text-sm font-black tabular-nums text-emerald-600">
                  {formatCurrency(forecast.projRev)}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-600">مصروف متوقع</p>
                <p className="mt-1 text-sm font-black tabular-nums text-rose-600">
                  {formatCurrency(forecast.projExp)}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-2xl border p-3",
                  forecast.projNet >= 0
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-rose-500/20 bg-rose-500/5",
                )}
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-muted">صافي متوقع</p>
                <p
                  className={cn(
                    "mt-1 text-sm font-black tabular-nums",
                    forecast.projNet >= 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {formatCurrency(forecast.projNet)}
                </p>
              </div>
            </div>
            <div className="mt-4 h-[150px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={forecast.cumulative} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="finForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={compactTick}
                    tick={{ fontSize: 10, fontWeight: 800, fill: "var(--muted)" }}
                  />
                  <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />
                  <Area
                    type="monotone"
                    dataKey="net"
                    name="الصافي التراكمي المتوقع"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    fill="url(#finForecast)"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-[10px] font-bold text-muted">
              متوسط يومي: إيراد {formatCurrency(forecast.avgRev)} • مصروف {formatCurrency(forecast.avgExp)} — الإسقاط
              خطي ويفترض استمرار نفس الوتيرة.
            </p>
          </ChartCard>
        )}
      </div>

      <PremiumCard hoverable={false} className="border-primary/20 bg-gradient-to-br from-indigo-500/[0.06] via-card to-violet-500/[0.06]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-main sm:text-2xl">المستشار المالي الذكي</h3>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-muted">
                  تحليل فعلي للبيانات الحالية وتوصيات نمو قابلة للتنفيذ
                </p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit text-[10px] font-black">
              AI POWERED
            </Badge>
          </div>
          <AIInsights data={aiInsights} isSidebar />
        </div>
      </PremiumCard>
    </div>
  );
}
