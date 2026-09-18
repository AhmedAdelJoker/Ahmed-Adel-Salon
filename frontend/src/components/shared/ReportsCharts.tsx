import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { currency } from "@/lib/format/formatters";
import PanelHeader from "@/components/shared/PanelHeader";
import EmptyState from "@/components/shared/EmptyState";
import { PieChart as PieChartIcon } from "lucide-react";
import { BarChart3, Scissors } from "lucide-react";

const COLORS = [
  "#9f7a48",
  "#5f7898",
  "#4d876e",
  "#a06d24",
  "#8a6f9e",
  "#a94442",
];

const tooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-2)",
  borderRadius: "16px",
  color: "var(--text-main)",
  boxShadow: "var(--shadow-md)",
};

const axisStyle = {
  fill: "var(--text-muted)",
  fontSize: 11,
  fontWeight: 700,
};

const gridStroke = "var(--border)";

export interface ReportOverviewData {
  payment_methods?: { payment_method?: string; total_amount?: number | string }[];
  top_barbers?: { barber_name?: string; total_revenue?: number | string }[];
  top_services?: { service_name?: string; total_revenue?: number | string }[];
  [key: string]: unknown;
}

export default function ReportsCharts({ reportOverview = {} }: { reportOverview?: ReportOverviewData }) {
  const payments = (reportOverview.payment_methods || []).map((item) => ({
    name: item.payment_method || "—",
    value: Number(item.total_amount || 0),
  }));

  const topBarbers = (reportOverview.top_barbers || []).map((item) => ({
    name: item.barber_name || "—",
    الإيراد: Number(item.total_revenue || 0),
  }));

  const topServices = (reportOverview.top_services || []).map((item) => ({
    name: item.service_name || "—",
    الإيراد: Number(item.total_revenue || 0),
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <section className="card rounded-3xl border border-border bg-card p-6 shadow-soft">
        <PanelHeader
          icon={<BarChart3 size={20} />}
          title="إيرادات حسب الحلاق"
          subtitle="مقارنة الإيرادات بين أفراد الفريق"
        />

        {topBarbers.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات"
            text="لا توجد إيرادات للحلاقين في الفترة المحددة."
          />
        ) : (
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topBarbers}
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <CartesianGrid
                  stroke={gridStroke}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => currency(Number(value))}
                />
                <Tooltip
                  formatter={(value) => currency(Number(value))}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="الإيراد"
                  fill="var(--accent)"
                  radius={[12, 12, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card rounded-3xl border border-border bg-card p-6 shadow-soft">
        <PanelHeader
          icon={<Scissors size={20} />}
          title="إيرادات حسب الخدمة"
          subtitle="الخدمات الأعلى تحقيقًا للإيرادات"
        />

        {topServices.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات"
            text="لا توجد إيرادات للخدمات في الفترة المحددة."
          />
        ) : (
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topServices}
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <CartesianGrid
                  stroke={gridStroke}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => currency(Number(value))}
                />
                <Tooltip
                  formatter={(value) => currency(Number(value))}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="الإيراد"
                  fill="var(--accent-2)"
                  radius={[12, 12, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card rounded-3xl border border-border bg-card p-6 shadow-soft xl:col-span-2">
        <PanelHeader
          icon={<PieChartIcon size={20} />}
          title="توزيع طرق الدفع"
          subtitle="تحليل المدفوعات حسب وسيلة التحصيل"
        />

        {payments.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات"
            text="لا توجد مدفوعات في الفترة المحددة."
          />
        ) : (
          <div className="mt-6 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={payments}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={120}
                  paddingAngle={3}
                >
                  {payments.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => currency(Number(value))}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}


