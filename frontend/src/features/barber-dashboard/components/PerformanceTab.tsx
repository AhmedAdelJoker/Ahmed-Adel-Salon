import { TrendingUp, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/core/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface PerformanceDatum {
  date: string;
  revenue: number;
  services: number;
  [key: string]: unknown;
}

interface PerformanceTabProps {
  performanceData: PerformanceDatum[];
  totalRevenue: number;
  totalServices: number;
}

export const PerformanceTab = ({ performanceData, totalRevenue, totalServices }: PerformanceTabProps) => {
  return (
    <div className="space-y-4">
      {/* Performance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-[9px] font-bold uppercase text-muted">إيرادات الأسبوع</p>
          <p className="text-xl font-black text-primary mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success/5 p-3">
          <p className="text-[9px] font-bold uppercase text-muted">خدمات الأسبوع</p>
          <p className="text-xl font-black text-success mt-1">{totalServices}</p>
        </div>
        <div className="rounded-xl border border-info/20 bg-info/5 p-3 col-span-2 md:col-span-1">
          <p className="text-[9px] font-bold uppercase text-muted">متوسط الخدمة</p>
          <p className="text-xl font-black text-info mt-1">
            {totalServices > 0 ? formatCurrency(totalRevenue / totalServices) : formatCurrency(0)}
          </p>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" /> أداء الأسبوع
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString("ar-EG", {
                    weekday: "short",
                  })
                }
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value: number | string, name: string) =>
                  name === "revenue" ? [formatCurrency(value), "الإيرادات"] : [value, "الخدمات"]
                }
                labelFormatter={(v: string) => new Date(v).toLocaleDateString("ar-EG")}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="services"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Services Bar Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-success" /> الخدمات اليومية
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString("ar-EG", {
                    weekday: "short",
                  })
                }
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number | string) => [value, "خدمة"]} />
              <Bar dataKey="services" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
