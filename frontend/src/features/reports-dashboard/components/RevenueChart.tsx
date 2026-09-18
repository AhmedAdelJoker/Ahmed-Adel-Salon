import { Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ContentPanel } from "@/components/shared/PremiumUI";
import { formatCurrency } from "@/lib/core/utils";
import type { WeeklyRow } from "@/features/reports-dashboard/constants";

export interface RevenueChartProps {
  chartRows: WeeklyRow[];
  chartType: string;
  onChartTypeChange: (value: string) => void;
  period: string;
  onPeriodChange: (value: string) => void;
}

export function RevenueChart({ chartRows, chartType, onChartTypeChange, period, onPeriodChange }: RevenueChartProps) {
  return (
    <ContentPanel className="xl:col-span-2" title={undefined} subtitle={undefined} actions={undefined}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Activity size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-black tracking-tight text-main truncate">
              تحليل تدفق الإيرادات
            </h3>
            <p className="text-xs font-bold text-muted truncate">
              مقارنة الإيرادات التشغيلية للفترة المختارة.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={chartType} onValueChange={onChartTypeChange}>
            <SelectTrigger className="h-9 rounded-xl text-sm">
              <SelectValue placeholder="نوع الرسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="area">مناطقي</SelectItem>
              <SelectItem value="bar">أعمدة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="h-[360px] sm:h-[420px] min-h-[320px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "area" ? (
            <AreaChart data={chartRows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--info)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--info)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 700 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}
                tickFormatter={(value) => `${(value/1000).toFixed(0)}K`}
                orientation="left"
                width={50}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-card)",
                  boxShadow: "var(--shadow-premium)",
                }}
                formatter={(value, name) => [
                  name === "revenue" ? formatCurrency(value) : value,
                  name === "revenue" ? "الإيرادات" : "المواعيد",
                ]}
                labelFormatter={(label) => label}
              />
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(name) => name === "revenue" ? "الإيرادات" : "المواعيد"}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="الإيرادات"
                stroke="var(--primary)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
              {chartRows.some((r) => r.appointments) && (
                <Area
                  type="monotone"
                  dataKey="appointments"
                  name="المواعيد"
                  stroke="var(--info)"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  fillOpacity={0.4}
                  fill="url(#colorAppointments)"
                  dot={false}
                />
              )}
            </AreaChart>
          ) : (
            <BarChart data={chartRows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}
                tickFormatter={(value) => `${(value/1000).toFixed(0)}K`}
              />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 700 }}
                width={90}
                orientation="left"
                padding={{ top: 10, bottom: 10 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-card)",
                  boxShadow: "var(--shadow-premium)",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: 20 }} />
              <Bar dataKey="revenue" name="الإيرادات" fill="var(--primary)" radius={[0, 8, 8, 0]} maxBarSize={40} />
              {chartRows.some((r) => r.appointments) && (
                <Bar dataKey="appointments" name="المواعيد" fill="var(--info)" radius={[0, 8, 8, 0]} maxBarSize={40} />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ContentPanel>
  );
}
