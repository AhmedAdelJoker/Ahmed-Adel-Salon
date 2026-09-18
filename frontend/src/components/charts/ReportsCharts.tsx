import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import EmptyState from "@/components/shared/EmptyState";
import { formatCurrency as currency } from "@/lib/core/utils";
import { ContentPanel } from "@/components/shared/PremiumUI";

const COLORS = ["#9f7a48", "#5f7898", "#4d876e", "#a06d24", "#a94442"];

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

export interface ChartReportOverview {
  top_barbers?: { barber_name?: string; total_revenue?: number | string }[];
  top_services?: { service_name?: string; total_revenue?: number | string }[];
  payment_methods?: { payment_method?: string; total_amount?: number | string }[];
  [key: string]: unknown;
}

export default function ReportsCharts({ reportOverview = {} }: { reportOverview?: ChartReportOverview }) {
  const topBarbers = reportOverview?.top_barbers || [];
  const topServices = reportOverview?.top_services || [];
  const paymentMethods = reportOverview?.payment_methods || [];

  const barberChartData = topBarbers.map((item) => ({
    name: item.barber_name || "—",
    revenue: item.total_revenue || 0,
  }));

  const serviceChartData = topServices.map((item) => ({
    name: item.service_name || "—",
    revenue: item.total_revenue || 0,
  }));

  const paymentChartData = paymentMethods.map((item) => ({
    name: item.payment_method || "—",
    value: item.total_amount || 0,
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Top Barbers */}
      <ContentPanel
        title="أفضل الخبراء"
        subtitle="مقارنة الإيرادات بين أفراد الفريق"
      >
        {barberChartData.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات"
            description="لا توجد إيرادات للخبراء في الفترة المحددة."
          />
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barberChartData}
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
                  tickFormatter={(value) => currency(value)}
                />
                <Tooltip
                  formatter={(value) => currency(value)}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="revenue"
                  fill="var(--accent)"
                  radius={[12, 12, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ContentPanel>

      {/* Top Services */}
      <ContentPanel
        title="أفضل الخدمات"
        subtitle="الخدمات الأعلى تحقيقًا للإيرادات"
      >
        {serviceChartData.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات"
            description="لا توجد إيرادات للخدمات في الفترة المحددة."
          />
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={serviceChartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient
                    id="serviceRevenue"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--accent)"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--accent)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
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
                  tickFormatter={(value) => currency(value)}
                />
                <Tooltip
                  formatter={(value) => currency(value)}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  fill="url(#serviceRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ContentPanel>

      {/* Payment Methods */}
      <ContentPanel
        title="طرق الدفع"
        subtitle="توزيع المدفوعات حسب الوسيلة المستخدمة"
        className="xl:col-span-2"
      >
        {paymentChartData.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات"
            description="لا توجد مدفوعات في الفترة المحددة."
          />
        ) : (
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={120}
                  paddingAngle={3}
                >
                  {paymentChartData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => currency(value)}
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
      </ContentPanel>
    </div>
  );
}
